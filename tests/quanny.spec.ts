import { expect, test, type Page } from "@playwright/test";
import {
  QUANNY_LOCATION_REVEAL,
  quannyCollectionInstruction,
} from "../src/systems/QuannyState";
import { newGame } from "../src/core/Simulation";
import { player, type GameState } from "../src/core/GameState";
import { moveTo } from "../src/board/presence";
import { acquire } from "../src/systems/StreetEconomy";
import { connect } from "../src/systems/Relationships";
import { currentEncounter, respondEncounter } from "../src/systems/Encounters";
import { AUTO_KEY, SAVE_KEY, serialize } from "../src/persistence/SaveSystem";
async function seed(page: Page, s: GameState) {
  // Isolate the encounter under test from unrelated historical notification overlays.
  s.acknowledgedEvents = s.events.map((e) => e.id);
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
const modal = (page: Page) =>
  page.getByRole("dialog", { name: "Character encounter" });
async function closeQuannyOutcome(
  page: Page,
  expression: "pleased" | "disappointed",
) {
  const image = modal(page).locator(".character-portrait img");
  await expect(image).toHaveAttribute(
    "src",
    new RegExp(`quanny-${expression}[.]webp$`),
  );
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const before = await snapshot(page);
  await modal(page)
    .getByRole("button", { name: "Return to City", exact: true })
    .click();
  expect(await snapshot(page)).toEqual(before);
}

async function visitReservoir(page: Page, place = "Lil Jay's Market") {
  await page
    .getByRole("group", { name: "Board location" })
    .getByRole("button", { name: "Stixx City" })
    .click();
  await page
    .getByRole("button", { name: "Select The Reservoir", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Places in The Reservoir" })
    .getByRole("button", { name: new RegExp(place) })
    .click();
  if (!(await snapshot(page)).quanny.met)
    await expect(modal(page)).toHaveCount(0);
  await page
    .getByRole("region", { name: place, exact: true })
    .getByRole("button", { name: "Go here" })
    .click();
}
function fronted() {
  let s = newGame("Morgan", "south", 9009);
  connect(s, s.playerId, "contact-blocks");
  s.characters["contact-blocks"].relationships.player.trust = 45;
  acquire(s, "contact-blocks", "cash");
  s = moveTo(s, "reservoir.lil-jays");
  for (const choice of ["claim:unaffiliated", "terms", "front"])
    s = respondEncounter(s, currentEncounter(s)!.id, choice).state;
  return s;
}
test("intentional board visit introduces Quanny once, fronts physical stock and persists on reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  let s = newGame("Morgan", "south", 9009);
  connect(s, s.playerId, "contact-blocks");
  s.characters["contact-blocks"].relationships.player.trust = 45;
  acquire(s, "contact-blocks", "cash");
  await seed(page, s);
  expect((await snapshot(page)).quanny.met).toBe(false);
  await expect(page.locator(".board-canvas")).toBeVisible({ timeout: 30000 });
  await visitReservoir(page, "Reservoir homes");
  await expect(modal(page)).toContainText("Aye, where you from?", {
    timeout: 25000,
  });
  await expect(
    modal(page).getByRole("button", { name: /This BackStreet/ }),
  ).toHaveCount(0);
  await modal(page)
    .getByRole("button", { name: /Ion bang/ })
    .click();
  await expect(modal(page)).toContainText("What you got?");
  await expect(modal(page)).toContainText(QUANNY_LOCATION_REVEAL);
  await expect(
    modal(page).getByRole("button", { name: /Ask Quanny for work/ }),
  ).toBeDisabled();
  await modal(page)
    .getByRole("button", { name: /Offer Quanny work/ })
    .click();
  await expect(modal(page)).toContainText("I need a front");
  await modal(page)
    .getByRole("button", { name: /Agree · front/ })
    .click();
  await closeQuannyOutcome(page, "pleased");
  await expect(modal(page)).toHaveCount(0);
  const after = await snapshot(page);
  expect(after.street.agreements[0]).toMatchObject({
    supplier: "player",
    debtor: "quanny",
    dueDay: after.day + 6,
  });
  expect(after.street.lots[0].remaining).toBe(0);
  expect(after.quanny.knownLocation).toBe("reservoir.lil-jays");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Merchandise fronted to others" }),
  ).toContainText(
    quannyCollectionInstruction(after, after.street.agreements[0].dueDay),
  );
  await nav.getByRole("button", { name: "People", exact: true }).click();
  await page
    .locator(".people-list")
    .getByRole("button", { name: /Quanny/ })
    .click();
  await expect(page.getByLabel("Known location for Quanny")).toContainText(
    "Lil Jay's Market, The Reservoir",
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  expect((await snapshot(page)).quanny).toEqual(after.quanny);
  expect((await snapshot(page)).street.agreements).toEqual(
    after.street.agreements,
  );
  await expect(modal(page)).toHaveCount(0);
});
for (const notoriety of [34, 35])
  test(`board collection at notoriety ${notoriety} records the correct permanent outcome`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    let s = fronted();
    player(s).notoriety = notoriety;
    s.day = s.street.agreements[0].dueDay;
    const before = player(s).wallet.clean + player(s).wallet.illicit,
      amount = s.street.agreements[0].original;
    s = moveTo(s, "south.towers");
    await seed(page, s);
    await visitReservoir(page);
    if (
      (await snapshot(page)).danger.scenes.some(
        (scene) => scene.status === "open",
      )
    )
      await modal(page)
        .getByRole("button", { name: /Hear them out/ })
        .click();
    await page
      .getByRole("region", { name: "Lil Jay's Market", exact: true })
      .locator('[data-action="quanny"]')
      .getByRole("button")
      .click();
    await expect(modal(page)).toContainText(`$${amount}`);
    await expect(
      modal(page).getByRole("button", { name: /Attempt violent/ }),
    ).toHaveCount(0);
    await modal(page)
      .getByRole("button", { name: /Collect \$/ })
      .click();
    await closeQuannyOutcome(
      page,
      notoriety >= 35 ? "pleased" : "disappointed",
    );
    await expect(modal(page)).toHaveCount(0);
    const after = await snapshot(page),
      a = after.street.agreements[0];
    expect(a.status).toBe(notoriety >= 35 ? "fulfilled" : "disputed");
    expect(player(after).wallet.clean + player(after).wallet.illicit).toBe(
      before + (notoriety >= 35 ? amount : 0),
    );
    await page.reload();
    await page.getByRole("button", { name: "Resume saved game" }).click();
    expect((await snapshot(page)).street.agreements[0]).toEqual(a);
  });
test("false BB dismissal reveals no private intention and cannot be rerolled by reloading", async ({
  page,
}) => {
  test.setTimeout(90000);
  await seed(
    page,
    moveTo(newGame("Morgan", "south", 42), "reservoir.lil-jays"),
  );
  await modal(page)
    .getByRole("button", { name: /This Big BB/ })
    .click();
  await closeQuannyOutcome(page, "disappointed");
  await expect(modal(page)).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    "recognized a false Blocc Boys claim immediately",
  );
  const after = await snapshot(page);
  expect(after.quanny.deception).toBe("known");
  expect(after.quanny.knownLocation).toBeUndefined();
  expect(after.danger.injuries).toHaveLength(0);
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  expect((await snapshot(page)).danger.conflicts).toEqual(
    after.danger.conflicts,
  );
});

test("Angels first-contact shooting uses hospital presentation and persists its nonfatal outcome", async ({
  page,
}) => {
  test.setTimeout(90000);
  let fixture: GameState | undefined;
  for (let seed = 1; seed < 150; seed++) {
    const s = moveTo(newGame("Morgan", "south", seed), "reservoir.lil-jays");
    const next = respondEncounter(
      s,
      currentEncounter(s)!.id,
      "claim:angels",
    ).state;
    if (next.quanny.shooting === "hospital") {
      fixture = s;
      break;
    }
  }
  expect(fixture).toBeDefined();
  await seed(page, fixture!);
  await modal(page)
    .getByRole("button", { name: /You see the wings/ })
    .click();
  await closeQuannyOutcome(page, "disappointed");
  await expect(
    page.getByRole("heading", { name: "Recovering in hospital" }),
  ).toBeVisible();
  const after = await snapshot(page);
  expect(after.quanny.shooting).toBe("hospital");
  expect(after.end).toBeNull();
  expect(after.danger.injuries[0].kind).toBe("shooting");
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  expect((await snapshot(page)).danger.injuries).toEqual(after.danger.injuries);
});

test("a Reservoir home starts the introduction on entering gameplay, before any travel", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("radio", { name: /The Reservoir/ }).check();
  await expect(modal(page)).toHaveCount(0);
  await page.getByRole("button", { name: /Enter Stixx City/ }).click();
  await expect(modal(page)).toContainText("Aye, where you from?");
  const s = await snapshot(page);
  expect(s.quanny.location).toBe("reservoir.homes");
  expect(s.presence?.trail ?? []).toHaveLength(0);
  await modal(page)
    .getByRole("button", { name: /Ion bang/ })
    .click();
  await expect(modal(page)).toContainText(QUANNY_LOCATION_REVEAL);
  expect((await snapshot(page)).quanny.knownLocation).toBe(
    "reservoir.lil-jays",
  );
});
