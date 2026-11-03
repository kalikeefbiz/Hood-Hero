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
const crumbs = (page: Page) =>
  page.getByRole("group", { name: "Board location" });
const places = (page: Page, zone: string) =>
  page.getByRole("region", { name: `Places in ${zone}` });
const saved = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
async function shot(
  page: Page,
  info: import("@playwright/test").TestInfo,
  name: string,
) {
  await page.waitForTimeout(2500);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, scale: "css" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("the player lives on the board: walks to places, acts there, and their location is saved", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  await seed(page, newGame("Morgan", "south"));
  await expect(page.locator(".board-canvas")).toBeVisible({ timeout: 30000 });
  // The game opens on your home district.
  await expect(crumbs(page)).toContainText("Southside");
  await expect(page.locator(".zone-details h3")).toHaveText("Southside");
  await expect(places(page, "Southside").getByRole("button")).toHaveCount(10);
  await shot(page, info, "01-home-district");

  // A place: risk, facts and its real moves as tiles.
  await places(page, "Southside")
    .getByRole("button", { name: /Southside Food Mart/ })
    .click();
  const card = page.getByRole("region", { name: "Southside Food Mart" });
  await expect(card).toContainText("Hiring · Neighborhood retail");
  await expect(card.getByLabel(/Risk here/)).toContainText("Safe");
  await shot(page, info, "02-food-mart");
  // Acting walks the player there, runs the existing action, and saves where they are.
  await card
    .getByRole("group", { name: "Moves at Southside Food Mart" })
    .locator('[data-action="buy"]')
    .first()
    .getByRole("button", { name: /Go/ })
    .click();
  await expect(page.locator(".action-feedback")).toBeVisible({
    timeout: 20000,
  });
  await expect(card).toContainText("You're here");
  await expect
    .poll(async () => (await saved(page)).presence?.location)
    .toBe("south.food-mart");

  // Travel without acting: hostile ground reads as risk, and the trail is kept.
  await crumbs(page).getByRole("button", { name: "Stixx City" }).click();
  await page
    .getByRole("button", { name: "Select The Nawf", exact: true })
    .click();
  await places(page, "The Nawf")
    .getByRole("button", { name: /Nawf Bodega/ })
    .click();
  const bodega = page.getByRole("region", { name: "Nawf Bodega" });
  await expect(bodega.getByLabel(/Risk here/)).toContainText(
    /Tense|Watchful|Hostile/,
  );
  await bodega.getByRole("button", { name: "Go here" }).click();
  await expect(bodega).toContainText("You're here", { timeout: 20000 });
  const after = await saved(page);
  expect(after.presence.location).toBe("nawf.bodega");
  expect(after.presence.trail.at(-1).location).toBe("south.food-mart");
  await shot(page, info, "03-in-the-nawf");

  // People stand in the world; a planned place is honest about it.
  await crumbs(page).getByRole("button", { name: "The Nawf" }).click();
  await expect(page.locator(".board-person")).not.toHaveCount(0);
  await places(page, "The Nawf")
    .getByRole("button", { name: /Nawf Community Center/ })
    .click();
  await expect(
    page.getByRole("region", { name: "Nawf Community Center" }),
  ).toContainText("Coming to Stixx City");

  // Your look is part of your character and survives saves.
  await page.getByRole("button", { name: /your character/ }).click();
  const look = page.getByRole("region", { name: "Your look" });
  await look.getByRole("button", { name: "afro", exact: true }).click();
  await look.getByRole("button", { name: "Done" }).click();
  await expect
    .poll(async () => (await saved(page)).presence?.appearance.hair)
    .toBe("afro");
  await shot(page, info, "04-new-look");

  // The classic screens are a ledger over the city.
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Wallet", exact: true })
    .click();
  await expect(page.locator(".business-panel")).toBeVisible();
  await page.getByRole("button", { name: "Back to the city" }).click();
  await expect(crumbs(page)).toBeVisible();
});

test("lab saves never touch production keys and The Reservoir is spelled right", async ({
  page,
}) => {
  await seed(page, newGame("Morgan", "reservoir"));
  await expect(
    page.getByRole("button", { name: "Select The Reservoir", exact: true }),
  ).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain(AUTO_KEY);
  expect(keys.some((k) => k.startsWith("blackhouse.syndicate"))).toBe(false);
  await expect(page.getByText(/Resevoir/)).toHaveCount(0);
});
