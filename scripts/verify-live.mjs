import { chromium, webkit, devices, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const [url, expected] = process.argv.slice(2);
if (!url || !expected)
  throw new Error(
    "Usage: node scripts/verify-live.mjs PUBLIC_URL EXPECTED_COMMIT",
  );
const infoURL = new URL("build-info.json", url);
infoURL.searchParams.set("verify", expected);
const metadata = JSON.parse(
  execFileSync("curl", ["-fsS", infoURL.href], { encoding: "utf8" }),
);
assert.equal(metadata.commit, expected);
assert.equal(metadata.saveSchema, 3);
mkdirSync("docs/screenshots/goal-003-correction", { recursive: true });
mkdirSync("docs/validation", { recursive: true });
const results = [];
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const browser = await engine.launch(
    proxyServer ? { proxy: { server: proxyServer } } : {},
  );
  try {
    const page = await browser.newPage({ ...devices["iPhone 13"] });
    const errors = [],
      failures = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && /\.(webp|woff2?|js|css)(\?|$)/.test(r.url()))
        failures.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(`${url}?verify=${expected}`, { waitUntil: "networkidle" });
    await page.getByLabel("What do people call you?").fill("Test(4)");
    await page.getByRole("button", { name: "Enter Stixx City" }).click();
    const modal = page.getByRole("dialog", { name: "Character encounter" });
    await expect(modal).toBeVisible();
    await expect
      .poll(() =>
        modal
          .locator("img")
          .evaluate((el) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true);
    await page.screenshot({
      path: `docs/screenshots/goal-003-correction/live-${name}-modal.png`,
      scale: "css",
    });
    await modal
      .getByRole("button", { name: "Tell me what happened", exact: false })
      .click();
    await expect(modal).toContainText("This wasn’t authorized");
    await modal
      .getByRole("button", { name: "I’ll help you", exact: false })
      .click();
    await expect(modal).toHaveCount(0);
    const nav = async (label) =>
      page
        .getByRole("navigation")
        .getByRole("button", { name: label, exact: true })
        .click();
    await nav("Actions");
    await page.locator('[data-action="gig"]').getByRole("button").click();
    await expect(page.locator(".notice")).toContainText("$38");
    await page.getByRole("button", { name: "End day" }).click();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: "City", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(modal).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "Resume saved game" }).click();
    await expect(modal).toHaveCount(0);
    await nav("Actions");
    await page.getByRole("button", { name: "Everyday", exact: true }).click();
    await page.locator('[data-action="gig"]').getByRole("button").click();
    await page.getByRole("button", { name: "The Chains", exact: true }).click();
    await page.locator('[data-action="buyback"]').getByRole("button").click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator(".action-feedback")).toBeVisible();
    await expect(page.locator(".action-feedback")).toContainText("paid $150");
    await nav("City");
    await expect(modal).toContainText("came through");
    await expect(modal.locator("img")).toHaveAttribute(
      "src",
      /confident-with-chain.webp$/,
    );
    await modal
      .getByRole("button", { name: "I hear you", exact: false })
      .click();
    await expect(modal).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "Resume saved game" }).click();
    await expect(modal).toHaveCount(0);
    const state = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("blackhouse.syndicate.v1.auto")).state,
    );
    assert.equal(
      state.commitments.find((c) => c.kind === "recover-property").status,
      "fulfilled",
    );
    assert.equal(state.properties.chains.possession.id, "mega");
    await page.screenshot({
      path: `docs/screenshots/goal-003-correction/live-${name}-city.png`,
      scale: "css",
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    results.push({
      browser: name,
      passed: true,
      openingModal: true,
      promiseAutoClosed: true,
      actionFeedback: true,
      endDayReturnsCity: true,
      reloadDidNotReopen: true,
      actualBuybackFulfilled: true,
      acknowledgedOutcomeStaysClosed: true,
      assetFailures: failures,
      pageErrors: errors,
    });
  } finally {
    await browser.close();
  }
}
const report = {
  url,
  commit: metadata.commit,
  saveSchema: metadata.saveSchema,
  verifiedAt: new Date().toISOString(),
  results,
};
writeFileSync(
  "docs/validation/GOAL_003_CORRECTION_LIVE.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
