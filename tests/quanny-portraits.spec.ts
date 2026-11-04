import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { newGame } from "../src/core/Simulation";
import { player } from "../src/core/GameState";
import { moveTo } from "../src/board/presence";
import { connect } from "../src/systems/Relationships";
import { acquire } from "../src/systems/StreetEconomy";
import { AUTO_KEY, SAVE_KEY, serialize } from "../src/persistence/SaveSystem";

const modal = (page: Page) =>
  page.getByRole("dialog", { name: "Character encounter" });
async function checkPortrait(page: Page, name: string, info: TestInfo) {
  const img = modal(page).locator(".character-portrait img");
  await expect(img).toHaveAttribute(
    "src",
    new RegExp(`quanny-${name}[.]webp$`),
  );
  await expect(img).toBeVisible();
  await expect
    .poll(() =>
      img.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const image = await img.boundingBox(),
    box = await modal(page).boundingBox();
  expect(image!.x).toBeGreaterThanOrEqual(box!.x);
  expect(image!.x + image!.width).toBeLessThanOrEqual(box!.x + box!.width);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await modal(page).screenshot({ path: info.outputPath(`quanny-${name}.png`) });
}
const snapshot = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );

test("all five Quanny portraits display and follow real iPhone encounter states without changing outcomes", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const allowed = [
    "neutral",
    "talking",
    "disappointed",
    "pleased",
    "thinking",
  ].map((name) => `quanny-${name}.webp`);
  const requested = new Set<string>();
  page.on("request", (request) => {
    if (request.url().includes("assets/characters/quanny/"))
      requested.add(new URL(request.url()).pathname.split("/").at(-1)!);
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const s = newGame("Morgan", "south", 9009);
  connect(s, s.playerId, "contact-blocks");
  s.characters["contact-blocks"].relationships.player.trust = 45;
  acquire(s, "contact-blocks", "cash");
  const intro = moveTo(s, "reservoir.lil-jays");
  intro.acknowledgedEvents = intro.events.map((e) => e.id);
  for (const e of intro.encounters)
    if (e.definitionId === "mega-chains-request") {
      e.status = "pending";
      e.deferred = true;
    }
  await page.goto("/");
  await page.evaluate(
    ({ key, raw }) => {
      localStorage.clear();
      localStorage.setItem(key, raw);
    },
    { key: SAVE_KEY, raw: serialize(intro) },
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await checkPortrait(page, "neutral", info);
  await modal(page)
    .getByRole("button", { name: /Ion bang/ })
    .click();
  await checkPortrait(page, "talking", info);
  await modal(page)
    .getByRole("button", { name: /Leave it unresolved/ })
    .click();
  await checkPortrait(page, "disappointed", info);
  await expect(modal(page).locator(".dialogue")).toHaveCount(0); // A silent reaction uses no invented NPC line.
  const departed = await snapshot(page);
  await modal(page)
    .getByRole("button", { name: "Return to City", exact: true })
    .click();
  expect(await snapshot(page)).toEqual(departed);

  await page
    .getByRole("group", { name: "Board location" })
    .getByRole("button", { name: "Stixx City" })
    .click();
  await page
    .getByRole("button", { name: "Select The Reservoir", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Places in The Reservoir" })
    .getByRole("button", { name: /Lil Jay's Market/ })
    .click();
  await page
    .getByRole("region", { name: "Lil Jay's Market", exact: true })
    .locator('[data-action="quanny"]')
    .getByRole("button")
    .click();
  await checkPortrait(page, "thinking", info);
  await modal(page)
    .getByRole("button", { name: /Offer Quanny work/ })
    .click();
  await checkPortrait(page, "talking", info);
  await modal(page)
    .getByRole("button", { name: /Agree · front/ })
    .click();
  await checkPortrait(page, "pleased", info);
  const agreed = await snapshot(page);
  expect(agreed.street.agreements[0]).toMatchObject({
    supplier: "player",
    debtor: "quanny",
    status: "pending",
    dueDay: agreed.day + 6,
  });
  expect(agreed.street.lots[0].remaining).toBe(0);
  expect(player(agreed).wallet).toEqual(player(intro).wallet);
  await expect(
    modal(page).getByRole("button", { name: /Agree · front/ }),
  ).toHaveCount(0);
  await modal(page)
    .getByRole("button", { name: "Return to City", exact: true })
    .click();
  expect(await snapshot(page)).toEqual(agreed);
  expect([...requested].sort()).toEqual(allowed.sort());
  expect(errors).toEqual([]);
});
