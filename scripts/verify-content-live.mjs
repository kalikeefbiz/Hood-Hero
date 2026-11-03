import chains from "../src/content/copy/storylines/the-chains.json" with { type: "json" };
import ui from "../src/content/copy/interface.json" with { type: "json" };
import actions from "../src/content/copy/actions.json" with { type: "json" };
import { formatCopy } from "../src/content/copy-rules.ts";
import { chromium, webkit, devices, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const [url, expected] = process.argv.slice(2);
if (!url || !expected)
  throw Error("Usage: node scripts/verify-content-live.mjs PUBLIC_URL COMMIT");
const curl = (address) =>
  execFileSync("curl", ["-fsS", "--retry", "2", address]);
const metadata = JSON.parse(curl(`${url}build-info.json?verify=${expected}`));
assert.equal(metadata.commit, expected);
assert.equal(metadata.saveSchema, 8);
assert.equal(metadata.milestone, "GOAL 007a");
const html = curl(`${url}?verify=${expected}`).toString();
const script = html.match(/<script[^>]+src="([^"]+)"/)[1];
const localHTML = readFileSync("dist/index.html", "utf8");
assert.equal(script, localHTML.match(/<script[^>]+src="([^"]+)"/)[1]);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const localBundle = readFileSync(`dist/assets/${script.split("/").at(-1)}`);
const bundleSHA256 = hash(curl(new URL(script, url).href));
assert.equal(
  bundleSHA256,
  hash(localBundle),
  "public bundle must match locally validated source",
);
const results = [];
for (const [engineName, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await engine.launch(
    proxy ? { proxy: { server: proxy } } : {},
  );
  try {
    const page = await browser.newPage({ ...devices["iPhone 13"] });
    const errors = [],
      failedAssets = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && /\.(js|css|webp|woff2?)(\?|$)/.test(r.url()))
        failedAssets.push(r.url());
    });
    await page.goto(`${url}?verify=${expected}`, { waitUntil: "networkidle" });
    await page.getByLabel(ui.newRun.whatDoPeopleCallYou).fill("Creator");
    await page.getByRole("button", { name: ui.newRun.enterStixxCity }).click();
    const modal = page.getByRole("dialog", { name: ui.app.characterEncounter });
    await expect(modal).toContainText(
      formatCopy("opening", chains.opening.dialogue, ["amount", "details"], {
        amount: 150,
        details: "",
      }),
    );
    await modal.locator('[data-response="clarify"]').click();
    await expect(modal).toContainText(
      formatCopy("clarification", chains.clarification.dialogue, ["amount"], {
        amount: 150,
      }),
    );
    await modal.locator('[data-response="promise"]').click();
    await expect(modal).toHaveCount(0);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: ui.navigation.actions, exact: true })
      .click();
    await page
      .getByRole("button", { name: ui.navigation.honest, exact: true })
      .click();
    await expect(page.locator('[data-action="gig"]')).toContainText(
      actions.localGig.description,
    );
    await page.locator('[data-action="gig"]').getByRole("button").click();
    await expect(page.locator(".action-feedback")).toContainText("$38");
    await page
      .getByRole("button", { name: ui.gameHUD.saveGame, exact: true })
      .click();
    await page.reload();
    await page.getByRole("button", { name: ui.newRun.resumeSavedGame }).click();
    await expect(page.locator(".game-shell")).toBeVisible();
    await page
      .getByRole("button", { name: ui.app.endDay.trim(), exact: true })
      .click();
    await expect(page.locator(".day")).toContainText("02");
    assert.deepEqual(errors, []);
    assert.deepEqual(failedAssets, []);
    results.push({
      engine: engineName,
      commit: expected,
      newGame: true,
      chains: true,
      action: true,
      saveLoad: true,
      advanceDay: true,
      errors,
      failedAssets,
    });
  } finally {
    await browser.close();
  }
}
const report = { metadata, bundleSHA256, url, results };
writeFileSync(
  process.env.CONTENT_LIVE_EVIDENCE || "/tmp/hood-content-live.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
