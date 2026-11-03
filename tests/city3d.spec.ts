import { test, expect, type Page } from "@playwright/test";
import { dismissEncounter } from "./helpers";
import { newGame } from "../src/core/Simulation";
import type { GameState } from "../src/core/GameState";
import { AUTO_KEY, SAVE_KEY, serialize } from "../src/persistence/SaveSystem";

async function seed(page: Page, state: GameState) {
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await page.evaluate(
    ({ key, raw }) => {
      localStorage.clear();
      localStorage.setItem(key, raw);
    },
    { key: SAVE_KEY, raw: serialize(state) },
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await dismissEncounter(page);
}
const settle = (page: Page, ms = 2500) => page.waitForTimeout(ms);
async function shot(
  page: Page,
  info: import("@playwright/test").TestInfo,
  name: string,
) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, scale: "css" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("3D city renders, selects districts and opens places into existing systems", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const state = newGame("Morgan", "south");
  state.strategic.businesses.push({
    id: "business-repair",
    definition: "repair",
    acquiredDay: 1,
    lastOperatingDay: 1,
    status: "profitable",
    provenance: "clean",
    condition: 85,
    lastNet: 23,
    totalNet: 23,
    profitableDays: 1,
    history: [],
  });
  state.assets.push({
    id: "business-repair",
    owner: state.playerId,
    value: 1170,
    provenance: "clean",
    recurringIncome: 0,
  });
  state.strategic.territories.nawf.contested = true;
  await seed(page, state);
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
  const stage = page.locator(".city3d-stage canvas");
  await expect(stage).toBeVisible({ timeout: 20000 });
  await settle(page, 2000);
  await page.locator(".map-panel").scrollIntoViewIfNeeded();
  await shot(page, info, "01-city-overview");

  const chips = page.getByRole("group", {
    name: "Five neighborhoods of Stixx City",
  });
  await expect(chips.getByRole("button")).toHaveCount(5);
  const nawf = chips.getByRole("button", {
    name: "Select The Nawf",
    exact: true,
  });
  await nawf.click();
  await expect(nawf).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".zone-details h3")).toHaveText("The Nawf");
  await settle(page);
  await shot(page, info, "02-nawf-contested");

  await chips
    .getByRole("button", { name: "Select Southside", exact: true })
    .click();
  await settle(page);
  await shot(page, info, "03-southside");
  await page
    .getByRole("button", { name: "Open Southside repair counter" })
    .click();
  const card = page.getByRole("region", { name: "Southside repair counter" });
  await expect(card).toContainText("Yours · profitable");
  await settle(page);
  await shot(page, info, "04-owned-business-card");
  await card.getByRole("button", { name: /View in Wallet/ }).click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Wallet", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "City", exact: true })
    .click();
  await expect(stage).toBeVisible({ timeout: 20000 });
  await chips
    .getByRole("button", { name: "Select Downtown", exact: true })
    .click();
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await settle(page, 1800);
  await page.locator(".map-panel").scrollIntoViewIfNeeded();
  await shot(page, info, "05-downtown-night");
  await page.getByRole("button", { name: "Open Downtown storefronts" }).click();
  await page
    .getByRole("region", { name: "Downtown storefronts" })
    .getByRole("button", { name: /Look for honest work/ })
    .click();
  await expect(page.locator('[data-action="apply"]').first()).toBeVisible();

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "City", exact: true })
    .click();
  await page.getByRole("button", { name: "Full screen city" }).click();
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await chips
    .getByRole("button", { name: "Select Rio Gabriel", exact: true })
    .click();
  await settle(page, 1800);
  await shot(page, info, "06-fullscreen-rio-day");
  await page.getByRole("button", { name: "Exit full screen city" }).click();

  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator("svg.city-map")).toBeVisible();
  await page.getByRole("button", { name: "3D city", exact: true }).click();
  await expect(stage).toBeVisible({ timeout: 20000 });
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
  expect(after).toEqual(before); // Exploring the city never changes the save.
});
