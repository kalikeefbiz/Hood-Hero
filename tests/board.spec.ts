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
const crumbs = (page: Page) => page.getByRole("navigation", { name: "Board location" });
const places = (page: Page, zone: string) =>
  page.getByRole("region", { name: `Places in ${zone}` });
async function shot(page: Page, info: import("@playwright/test").TestInfo, name: string) {
  await page.waitForTimeout(2500);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, scale: "css" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("the board navigates city → district → block → place and acts through existing systems", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const state = newGame("Morgan", "south");
  await seed(page, state);
  await expect(page.locator(".board-canvas")).toBeVisible({ timeout: 30000 });
  await expect(crumbs(page)).toContainText("Stixx City");
  await shot(page, info, "01-city");

  // District level: the sheet lists every place, live ones first.
  await page.getByRole("button", { name: "Select Southside", exact: true }).click();
  await expect(crumbs(page)).toContainText("Southside");
  await expect(places(page, "Southside").getByRole("button")).toHaveCount(10);
  await expect(page.locator(".zone-details h3")).toHaveText("Southside");
  await shot(page, info, "02-southside");

  // Place level: real actions on the place card.
  await places(page, "Southside").getByRole("button", { name: /Southside Food Mart/ }).click();
  const card = page.getByRole("region", { name: "Southside Food Mart" });
  await expect(card).toContainText("Hiring · Neighborhood retail");
  await expect(crumbs(page)).toContainText("Block");
  const moves = card.getByRole("group", { name: "Moves at Southside Food Mart" });
  await expect(moves.locator(".action-card")).not.toHaveCount(0);
  await shot(page, info, "03-food-mart");
  await moves.locator('[data-action="buy"]').first().getByRole("button").first().click();
  await expect(page.locator(".action-feedback")).toBeVisible();

  // The home base offers rest; the storyline is reachable from the Towers.
  await crumbs(page).getByRole("button", { name: "Southside" }).click();
  await places(page, "Southside").getByRole("button", { name: /Southside Towers/ }).click();
  await expect(page.getByRole("region", { name: "Southside Towers" })).toContainText("Your home turf");

  // Lenses and the divided Nawf.
  await crumbs(page).getByRole("button", { name: "Stixx City" }).click();
  await page.getByRole("button", { name: "Select The Nawf", exact: true }).click();
  await page.getByRole("button", { name: "Influence", exact: true }).click();
  await expect(page.getByRole("button", { name: "Influence", exact: true })).toHaveAttribute("aria-pressed", "true");
  await shot(page, info, "04-nawf-influence");
  await page.getByRole("button", { name: "Streets", exact: true }).click();
  await places(page, "The Nawf").getByRole("button", { name: /Nawf Barbershop/ }).click();
  const barber = page.getByRole("region", { name: "Nawf Barbershop" });
  await expect(barber.getByRole("heading", { name: "Around here" })).toBeVisible();

  // A planned place is honest about it.
  await crumbs(page).getByRole("button", { name: "The Nawf" }).click();
  await places(page, "The Nawf").getByRole("button", { name: /Nawf Community Center/ }).click();
  await expect(page.getByRole("region", { name: "Nawf Community Center" })).toContainText("Coming to Stixx City");

  // Existing screens open over the city and the dock still works.
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.locator(".business-panel")).toBeVisible();
  await page.getByRole("button", { name: "Back to the city" }).click();
  await expect(crumbs(page)).toBeVisible();
});

test("lab saves never touch production keys and The Reservoir is spelled right", async ({ page }) => {
  const state = newGame("Morgan", "reservoir");
  await seed(page, state);
  await expect(page.getByRole("button", { name: "Select The Reservoir", exact: true })).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain(AUTO_KEY);
  expect(keys.some((k) => k.startsWith("blackhouse.syndicate"))).toBe(false);
  await expect(page.getByText(/Resevoir/)).toHaveCount(0);
});
