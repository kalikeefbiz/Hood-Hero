import { chromium, webkit, devices, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const [url, expected] = process.argv.slice(2);
if (!url || !expected)
  throw new Error(
    "Usage: node scripts/verify-employment-live.mjs PUBLIC_URL COMMIT",
  );
const metadata = JSON.parse(
  execFileSync("curl", ["-fsS", `${url}build-info.json?verify=${expected}`], {
    encoding: "utf8",
  }),
);
assert.equal(metadata.commit, expected);
assert.equal(metadata.saveSchema, 4);
assert.equal(metadata.milestone, "GOAL 004");
mkdirSync("docs/validation", { recursive: true });
mkdirSync("docs/screenshots/goal-004", { recursive: true });
const results = [];
const writeEvidence = process.env.VERIFY_WRITE_EVIDENCE !== "0";
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const browser = await engine.launch(
    proxy ? { proxy: { server: proxy } } : {},
  );
  try {
    const page = await browser.newPage({ ...devices["iPhone 13"] });
    const errors = [],
      failures = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && /\.(webp|js|css|woff2?)(\?|$)/.test(r.url()))
        failures.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(`${url}?verify=${expected}`, { waitUntil: "networkidle" });
    await page.getByLabel("What do people call you?").fill("Test(4) Live");
    await page.getByRole("button", { name: "Enter Stixx City" }).click();
    const modal = page.getByRole("dialog", {
      name: "Character encounter",
      exact: true,
    });
    const close = async () => {
      if (await modal.count())
        await modal.getByRole("button", { name: "Close conversation" }).click();
    };
    await close();
    const nav = async (name) =>
      page
        .getByRole("navigation")
        .getByRole("button", { name, exact: true })
        .click();
    const saved = async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("blackhouse.syndicate.v1.auto"))
            .state,
      );
    const click = async (type) =>
      page
        .locator(`[data-action="${type}"]`)
        .first()
        .getByRole("button")
        .click();
    const capture = async (label) => {
      if (!writeEvidence) return;
      await page.screenshot({
        path: `docs/screenshots/goal-004/live-${name}-${label}.png`,
        scale: "css",
        animations: "disabled",
      });
    };
    const end = async () => {
      const handle = (d) => d.accept();
      page.once("dialog", handle);
      await page.getByRole("button", { name: "End day" }).click();
      page.off("dialog", handle);
      await close();
    };
    assert.equal((await saved()).characters.player.wallet.clean, 125);
    await nav("Actions");
    await expect(page.locator('[data-action="work"] button')).toBeDisabled();
    await click("apply");
    await click("acceptJob");
    assert.equal((await saved()).employment[0].status, "employed");
    await nav("Wallet");
    await expect(page.locator(".action-feedback")).toHaveCount(0, {
      timeout: 7000,
    });
    await page.locator(".employment-summary").scrollIntoViewIfNeeded();
    await capture("hired");
    await end();
    await nav("Actions");
    await click("work");
    if (await modal.count())
      await modal.getByRole("button", { name: /Skip scene/ }).click();
    let s = await saved();
    assert.equal(s.ap, 0);
    assert.equal(s.progression.cleanEarned, 96);
    assert.equal(s.employment[0].attendance[0].status, "worked");
    await page.reload();
    await page.getByRole("button", { name: "Resume saved game" }).click();
    await close();
    assert.equal((await saved()).employment[0].attendance.length, 1);
    // Skip the next three scheduled shifts through normal day controls.
    for (let d = 2; d <= 9; d++) await end();
    s = await saved();
    assert.equal(s.employment[0].status, "terminated");
    assert.equal(
      s.employment[0].attendance.filter((a) => a.status === "missed").length,
      3,
    );
    assert.equal(s.employmentSearch.player.eligibleDay, 16);
    await expect(page.locator(".major-notification")).toContainText(
      "Employment terminated",
    );
    await page.locator(".major-notification").scrollIntoViewIfNeeded();
    await capture("terminated");
    await nav("Actions");
    for (const b of await page.locator('[data-action="apply"] button').all())
      await expect(b).toBeDisabled();
    await click("gig");
    assert.equal((await saved()).progression.cleanEarned, 134);
    await expect(page.locator('[data-action="gig"] button')).toBeDisabled();
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    results.push({
      browser: name,
      url,
      commit: expected,
      day: s.day,
      attendance: s.employment[0].attendance.map((a) => ({
        day: a.day,
        status: a.status,
      })),
      status: s.employment[0].status,
      applicationsReopen: s.employmentSearch.player.eligibleDay,
      lawfulIncomeAfterGig: 134,
      errors,
      failures,
    });
    console.log(
      `${name}: public hiring, saved wages, three absences, firing, cooldown and gig verified`,
    );
  } finally {
    await browser.close();
  }
}
if (writeEvidence)
  writeFileSync(
    "docs/validation/GOAL_004_LIVE.json",
    JSON.stringify({ metadata, results }, null, 2) + "\n",
  );
