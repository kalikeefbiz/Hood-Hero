import { chromium, webkit, devices, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const [url, expected] = process.argv.slice(2);
if (!url || !expected)
  throw new Error("Usage: node scripts/verify-crew-live.mjs PUBLIC_URL COMMIT");
const metadata = JSON.parse(
  execFileSync("curl", ["-fsS", `${url}build-info.json?verify=${expected}`], {
    encoding: "utf8",
  }),
);
assert.equal(metadata.commit, expected);
assert.equal(metadata.milestone, "GOAL 005");
assert.equal(metadata.saveSchema, 5);
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
    await page.getByLabel("What do people call you?").fill("Test(5) Live");
    await page.getByRole("button", { name: "Enter Stixx City" }).click();
    const modal = page.getByRole("dialog", {
      name: "Character encounter",
      exact: true,
    });
    const close = async () => {
      for (let i = 0; i < 8 && (await modal.count()); i++)
        await modal
          .getByRole("button", { name: "Close conversation", exact: true })
          .click();
    };
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
    const day = async () => {
      await page.getByRole("button", { name: "End day" }).click();
      await close();
    };
    const interact = async (member) => {
      await nav("Set");
      await page
        .getByRole("button", { name: `Interact with ${member}`, exact: true })
        .click();
    };
    await close();
    await interact("Flacco");
    await expect(modal).toContainText("Work: learning");
    if (writeEvidence)
      await page.screenshot({
        path: `docs/screenshots/goal-005/live-${name}-interaction.png`,
      });
    await modal.getByRole("button", { name: /^Paid local work/ }).click();
    let s = await saved();
    assert.equal(s.assignments[0].status, "active");
    assert.equal(s.characters.player.wallet.clean, 113);
    await interact("Flacco");
    await modal.getByRole("button", { name: /^Spend time together/ }).click();
    s = await saved();
    assert.equal(s.assignments.at(-1).status, "refused");
    assert.equal(s.ap, 1);
    await day();
    s = await saved();
    assert.equal(s.assignments[0].status, "resolved");
    assert.ok(s.assignments[0].outcome);
    for (let i = 0; i < 12; i++) {
      s = await saved();
      if (
        s.crew.capacity >= 2 &&
        s.characters["resident-south"].relationships.player.trust >= 42
      )
        break;
      if (!s.ap) await day();
      await nav("Set");
      await page
        .getByRole("button", {
          name: "Build relationship with Robin",
          exact: true,
        })
        .click();
      await page
        .locator(".action-card")
        .filter({
          has: page.getByRole("heading", {
            name: "Spend time together",
            exact: true,
          }),
        })
        .getByRole("button")
        .click();
    }
    if (!(await saved()).ap) await day();
    await nav("Set");
    await page
      .locator(".recruit-row")
      .filter({ has: page.getByText("Robin", { exact: true }) })
      .getByRole("button", { name: "Invite", exact: true })
      .click();
    s = await saved();
    assert.ok(s.crew.members.includes("resident-south"));
    assert.ok(
      s.characters["resident-south"].skills.work >
        s.characters.flacco.skills.work,
    );
    let offerEvidence, appointment;
    for (let i = 0; i < 35; i++) {
      s = await saved();
      const o = s.crewOffers.find((o) => o.status === "pending");
      if (o && !offerEvidence) {
        await nav("Set");
        await page
          .getByRole("button", { name: "Hear the offer", exact: true })
          .click();
        await modal.getByRole("button", { name: /^Tell me more/ }).click();
        if (writeEvidence)
          await page.screenshot({
            path: `docs/screenshots/goal-005/live-${name}-offer.png`,
          });
        await modal.getByRole("button", { name: /^I'm in/ }).click();
        offerEvidence = {
          member: o.member,
          createdDay: o.createdDay,
          activity: o.activity,
        };
      }
      s = await saved();
      const a = s.assignments.find(
        (a) => a.status === "accepted" && a.dueDay === s.day,
      );
      if (a) {
        await interact(s.characters[a.member].name);
        await modal
          .getByRole("button", { name: /^Join scheduled activity/ })
          .click();
        appointment = (await saved()).assignments.find((x) => x.id === a.id);
        break;
      }
      await day();
    }
    assert.ok(offerEvidence);
    assert.equal(appointment?.status, "resolved");
    assert.ok(appointment.commitmentId);
    await nav("Set");
    if (writeEvidence)
      await page.screenshot({
        path: `docs/screenshots/goal-005/live-${name}-crew.png`,
      });
    const before = await saved();
    await page.getByLabel("Save game", { exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Resume saved game" }).click();
    await close();
    assert.deepEqual((await saved()).assignments, before.assignments);
    assert.deepEqual((await saved()).crew, before.crew);
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    results.push({
      browser: name,
      day: before.day,
      crew: before.crew,
      completedWork: before.assignments[0].outcome,
      refusal: before.assignments[1].outcome,
      offer: offerEvidence,
      appointment,
      scriptErrors: errors,
      assetFailures: failures,
    });
    console.log(
      `${name}: live work, refusal, natural recruitment, autonomous offer, attendance and saved consequences passed`,
    );
  } finally {
    await browser.close();
  }
}
if (writeEvidence)
  writeFileSync(
    "docs/validation/GOAL_005_LIVE.json",
    JSON.stringify(
      { url, verifiedAt: new Date().toISOString(), metadata, results },
      null,
      2,
    ) + "\n",
  );
