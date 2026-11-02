import { honest } from "./helpers";
import { dismissEncounter } from "./helpers";
import { test, expect } from "@playwright/test";
import { newGame } from "../src/core/Simulation";
import { performAction } from "../src/core/ActionEngine";
import { player } from "../src/core/GameState";
import { SAVE_KEY, serialize } from "../src/persistence/SaveSystem";

test("GOAL 002B mandatory visual review: new run, independent and Blips at 390", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  async function capture(name: string, fullPage = false) {
    await page.evaluate(() => document.fonts.ready);
    for (const image of await page.locator("img").all()) {
      if (!(await image.isVisible())) continue;
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage,
      scale: "css",
    });
    await info.attach(name, {
      path: info.outputPath(`${name}.png`),
      contentType: "image/png",
    });
  }
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await capture("01-new-run-390");
  await capture("01-new-run-full-390", true);
  await page.getByLabel("What do people call you?").fill("Morgan");
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await dismissEncounter(page);
  // GOAL 003 introduces an opening scene. Closing it restores the GOAL 002 city.
  await dismissEncounter(page);
  await capture("02-independent-city-390");
  await expect(page.locator(".game-shell")).toHaveAttribute(
    "data-theme",
    "independent",
  );
  const dock = (await page.getByRole("navigation").boundingBox())!;
  await expect(page.locator(".action-card")).toHaveCount(0);
  const situation = (await page.locator(".story-alert").boundingBox())!;
  expect(situation.y + situation.height).toBeLessThanOrEqual(dock.y);
  await page.getByRole("button", { name: "Open The Chains storyline" }).click();
  await expect(
    page.getByRole("dialog", { name: "Character encounter" }),
  ).toContainText("Cuzzo");
  await dismissEncounter(page);
  await honest(page);
  const work = page.locator('[data-action="gig"]');
  await work.scrollIntoViewIfNeeded();
  await expect(work).toBeVisible();
  await expect(work).toContainText("$38");
  const s = newGame("Morgan", "nawf");
  const p = player(s),
    sponsor = Object.values(s.characters).find(
      (c) => c.affiliation === "blips" && c.status === "active",
    )!;
  p.known = [...new Set([...p.known, sponsor.id])];
  p.organizationStanding.blips = 35;
  sponsor.relationships.player = {
    trust: 35,
    respect: 10,
    affection: 0,
    grievance: 0,
    history: [],
  };
  const result = performAction(s, {
    type: "affiliate",
    actor: "player",
    target: sponsor.id,
  });
  expect(result.error).toBeNull();
  await page.evaluate(
    ({ key, raw }) => {
      localStorage.clear();
      localStorage.setItem(key, raw);
    },
    { key: SAVE_KEY, raw: serialize(result.state) },
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await dismissEncounter(page);
  await capture("03-blips-city-390");
  await expect(page.locator(".game-shell")).toHaveAttribute(
    "data-theme",
    "blips",
  );
});
