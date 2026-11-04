import { performAction } from "../src/core/ActionEngine";
import { expect, test, type Page } from "@playwright/test";
import { newGame } from "../src/core/Simulation";
import { player, type GameState } from "../src/core/GameState";
import { record } from "../src/core/EventLog";
import { moveTo } from "../src/board/presence";
import {
  addGrievance,
  streetConversation,
  witnessIdentity,
} from "../src/systems/Danger";
import { AUTO_KEY, SAVE_KEY, serialize } from "../src/persistence/SaveSystem";

async function seed(page: Page, s: GameState) {
  // Hide the unrelated opening request, retaining its incident in the living world.
  for (const e of s.encounters)
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
    { key: SAVE_KEY, raw: serialize(s) },
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(page.locator(".game-shell")).toBeVisible();
}
const snapshot = (page: Page): Promise<GameState> =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
function encounterSeed() {
  for (let seed = 1; seed < 200; seed++) {
    const s = newGame("Morgan", "south", seed);
    for (const c of Object.values(s.characters))
      if (![s.playerId, "contact-muds"].includes(c.id)) c.availableDay = 99;
    const arrived = moveTo(s, "nawf.deli");
    if (streetConversation(arrived)) return s;
  }
  throw new Error("No seeded encounter found");
}

test("board street conversation: choices, persistent grievance, menus cannot reroll, reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, encounterSeed());
  await expect(page.locator(".board-canvas")).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("group", { name: "Board location" })
    .getByRole("button", { name: "Stixx City" })
    .click();
  await page
    .getByRole("button", { name: "Select The Nawf", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Places in The Nawf" })
    .getByRole("button", { name: /Nawf Deli/ })
    .click();
  await page
    .getByRole("region", { name: "Nawf Deli & Grocery", exact: true })
    .getByRole("button", { name: "Go here" })
    .click();
  const modal = page.getByRole("dialog", { name: "Character encounter" });
  await expect(modal).toContainText("Mudgang contact", { timeout: 25000 });
  await expect(modal).toContainText("Where are you from?");
  await expect(
    modal.getByRole("button", { name: /Hear them out/ }),
  ).toBeVisible();
  await modal
    .getByRole("button", { name: /Dismiss them disrespectfully/ })
    .click();
  await expect(modal).toHaveCount(0);
  const after = await snapshot(page);
  expect(after.danger.conflicts).toHaveLength(1);
  expect(after.danger.conflicts[0].state).toBe("unresolved");
  expect(after.danger.conflicts[0].scope).toBe("personal");
  expect(after.end).toBeNull();
  await page.getByRole("button", { name: "Hide details" }).click();
  await page.getByRole("button", { name: "Show details" }).click();
  const menu = page.getByRole("navigation", { name: "Main navigation" });
  await menu.getByRole("button", { name: "Wallet", exact: true }).click();
  await page.getByRole("button", { name: "Back to the city" }).click();
  expect((await snapshot(page)).danger).toEqual(after.danger);
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  expect((await snapshot(page)).danger.conflicts).toEqual(
    after.danger.conflicts,
  );
  expect(errors).toEqual([]);
});

test("a recognized war member can be injured directly; recovery advances city time and preserves consequences", async ({
  page,
}) => {
  test.setTimeout(120000);
  let chosen: GameState | undefined;
  for (let seed = 1; seed < 200; seed++) {
    const s = newGame("Morgan", "south", seed);
    player(s).affiliation = "blips";
    for (const c of Object.values(s.characters))
      if (![s.playerId, "contact-muds"].includes(c.id)) c.availableDay = 99;
    const e = record(s, "social", "Directly disclosed affiliation", [
      s.playerId,
      "contact-muds",
    ]);
    witnessIdentity(
      s,
      "contact-muds",
      s.playerId,
      e.id,
      "nawf.deli",
      "witness",
      true,
    );
    const next = moveTo(s, "nawf.deli");
    if (next.danger.injuries[0]?.kind === "shooting") {
      chosen = next;
      break;
    }
  }
  expect(chosen).toBeDefined();
  await seed(page, chosen!);
  const stay = chosen!.danger.injuries[0];
  await expect(
    page.getByRole("heading", { name: "Recovering in hospital" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete hospital recovery" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recovering in hospital" }),
  ).toHaveCount(0);
  const s = await snapshot(page);
  expect(s.day).toBe(stay.releaseDay);
  expect(s.danger.injuries[0].discharged).toBe(true);
  expect(s.street.arrears).toBeGreaterThan(chosen!.street.arrears);
  expect(s.factions).not.toEqual(chosen!.factions);
  expect(s.end).toBeNull();
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  expect((await snapshot(page)).danger.injuries[0].discharged).toBe(true);
});

test("terminal conflict death ends activity and manual load can restore the earlier checkpoint", async ({
  page,
}) => {
  test.setTimeout(120000);
  let dead: GameState | undefined;
  for (let seed = 1; seed < 500; seed++) {
    const s = newGame("Morgan", "south", seed);
    for (const c of Object.values(s.characters))
      if (![s.playerId, "contact-muds"].includes(c.id)) c.availableDay = 99;
    const e = record(s, "risk", "Established lethal personal conflict", [
      s.playerId,
      "contact-muds",
    ]);
    addGrievance(
      s,
      "contact-muds",
      s.playerId,
      "Established lethal personal conflict",
      e.id,
      95,
      true,
    );
    const next = moveTo(s, "nawf.deli");
    if (next.end) {
      dead = next;
      break;
    }
  }
  expect(dead?.end).toBe("killed");
  await seed(page, dead!);
  await expect(
    page.getByRole("heading", { name: "Your run ended: killed" }),
  ).toBeVisible();
  const manual = newGame("Earlier Morgan", "south");
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: SAVE_KEY,
    raw: serialize(manual),
  });
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your run ended: killed" }),
  ).toHaveCount(0);
  expect((await snapshot(page)).end).toBeNull();
});

test("a meaningful Wallet activity opens a contextual street conversation on the City board", async ({
  page,
}) => {
  test.setTimeout(90000);
  let chosen: GameState | undefined;
  for (let seed = 1; seed < 500; seed++) {
    const original = newGame("Morgan", "south", seed);
    for (const c of Object.values(original.characters))
      if (![original.playerId, "contact-muds"].includes(c.id))
        c.availableDay = 99;
    const s = moveTo(original, "nawf.deli");
    if (streetConversation(s) || s.end) continue;
    const next = performAction(s, {
      actor: s.playerId,
      type: "buy",
      item: "necessities",
    });
    if (!next.error && streetConversation(next.state)) {
      chosen = s;
      break;
    }
  }
  expect(chosen).toBeDefined();
  await seed(page, chosen!);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Wallet", exact: true })
    .click();
  await page.locator('[data-action="buy"]').first().getByRole("button").click();
  const modal = page.getByRole("dialog", { name: "Character encounter" });
  await expect(modal).toContainText("Mudgang contact");
  await modal
    .getByRole("button", { name: "Hear them out", exact: false })
    .click();
  const after = await snapshot(page);
  expect(after.ap).toBe(chosen!.ap - 1);
  expect(after.danger.scenes[0].outcome).toContain("peacefully");
  expect(after.danger.conflicts).toHaveLength(0);
});
