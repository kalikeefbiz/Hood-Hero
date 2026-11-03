import { openJournal } from "./journal";
import { honest, connects, storyline, storyAction } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { newGame } from "../src/core/Simulation";
import { advanceDay } from "../src/core/TimeSystem";
import { record, unseenEvents } from "../src/core/EventLog";
import { respondEncounter } from "../src/systems/Encounters";
import { incidentPromise } from "../src/systems/Commitments";
import { serialize, SAVE_KEY, AUTO_KEY } from "../src/persistence/SaveSystem";
import type { GameState, ZoneId, FactionId } from "../src/core/GameState";
import { THEMES } from "../src/ui/theme";
const root = process.env.PLAYWRIGHT_BASE_PATH || "/";
const modal = (page: Page) =>
  page.getByRole("dialog", { name: "Character encounter", exact: true });
const reply = (page: Page, text: string) =>
  modal(page).getByRole("button", { name: text, exact: false });
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
  if (name === "Actions")
    await page.getByRole("button", { name: "Honest", exact: true }).click();
}
async function seed(page: Page, s = newGame("Test(3)", "south")) {
  await page.goto(root);
  await page.evaluate(
    ({ key, raw }) => {
      localStorage.clear();
      localStorage.setItem(key, raw);
    },
    { key: SAVE_KEY, raw: serialize(s) },
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const portrait = modal(page).locator("img");
  if (await portrait.count())
    await expect
      .poll(() =>
        portrait.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
  const path =
    test.info().project.name === "chromium-mobile"
      ? `docs/screenshots/goal-003-correction/${name}.png`
      : test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, scale: "css", animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}
async function acknowledge(page: Page) {
  await reply(page, "I hear you").click();
}
async function declineCrewOffer(page: Page) {
  const e = (await saved(page)).encounters.find((e) => e.status === "active");
  if (e?.definitionId === "crew-offer")
    await reply(page, "Can't make it").click();
}
async function endDay(page: Page) {
  await page.getByRole("button", { name: "End day" }).click();
}

test("true City modal, sequential questions, promise closure, queued fulfillment, history and Resume", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await expect(modal(page)).toHaveJSProperty("open", true);
  await expect(modal(page)).toContainText("out with my girl");
  await expect(modal(page).locator("img")).toHaveAttribute(
    "src",
    /concerned-no-chain.webp$/,
  );
  const original = await saved(page);
  await expect(
    page
      .getByRole("button", { name: "End day", includeHidden: true })
      .click({ timeout: 700 }),
  ).rejects.toThrow();
  expect((await saved(page)).day).toBe(1);
  for (let n = 0; n < 7; n++) {
    await page.keyboard.press("Tab");
    expect(
      await modal(page).evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await capture(page, "01-modal-over-city");
  await reply(page, "Tell me what happened").click();
  await expect(modal(page)).toContainText("This wasn’t authorized");
  await expect(modal(page).locator("img")).toHaveAttribute(
    "src",
    /confident-no-chain.webp$/,
  );
  expect((await saved(page)).rng).toBe(original.rng);
  await capture(page, "02-contextual-exchange");
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(modal(page)).toContainText("This wasn’t authorized");
  await reply(page, "I’ll help you").click();
  await expect(modal(page)).toHaveCount(0);
  await openJournal(page);
  await expect(
    page.getByRole("region", { name: "Your promises" }),
  ).toContainText("8 days remaining");
  expect(incidentPromise(await saved(page), "the-chains")?.status).toBe(
    "pending",
  );
  await expect(page.locator(".action-feedback")).toBeVisible();
  await expect(page.locator(".action-feedback")).toHaveCount(0, {
    timeout: 7000,
  });
  await capture(page, "03-conversation-concluded-city");
  await page.getByLabel("Save game", { exact: true }).click();
  for (const destination of ["Actions", "People", "Set", "Wallet"]) {
    await nav(page, destination);
    await expect(modal(page)).toHaveCount(0);
  }
  await nav(page, "Actions");
  await page.locator('[data-action="gig"]').getByRole("button").click();
  await expect(page.getByRole("status")).toContainText("$38");
  await storyline(page);
  await page
    .getByRole("dialog", { name: "Character encounter" })
    .getByRole("button", { name: /Pay to return the chains/ })
    .click();
  expect(
    unseenEvents(await saved(page)).filter(
      (e) => e.incidentId === "the-chains",
    ),
  ).toHaveLength(1);
  await expect(modal(page)).toContainText("You came through for me");
  await expect(modal(page).locator("img")).toHaveAttribute(
    "src",
    /confident-with-chain.webp$/,
  );
  await expect(page.locator(".major-notification")).toHaveCount(0);
  await capture(page, "05-single-fulfilled-outcome");
  await acknowledge(page);
  await expect(modal(page)).toHaveCount(0);
  expect(
    unseenEvents(await saved(page)).filter(
      (e) => e.incidentId === "the-chains",
    ),
  ).toHaveLength(0);
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(modal(page)).toHaveCount(0);
  expect(incidentPromise(await saved(page), "the-chains")?.status).toBe(
    "fulfilled",
  );
  await openJournal(page);
  await page.getByText("Important outcomes", { exact: false }).click();
  const before = await saved(page);
  await page.getByRole("button", { name: "Revisit Cuzzo’s reaction" }).click();
  await expect(modal(page)).toContainText("RECORDED ENCOUNTER");
  await expect(
    modal(page).getByRole("button", { name: "I hear you", exact: false }),
  ).toHaveCount(0);
  await modal(page).getByRole("button", { name: "Close conversation" }).click();
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("refusing, postponing, Escape and backdrop leave no accidental obligation or daily reopening", async ({
  page,
}) => {
  await seed(page);
  await page.keyboard.press("Escape");
  await expect(modal(page)).toHaveCount(0);
  expect((await saved(page)).commitments).toHaveLength(0);
  await page
    .getByRole("button", { name: "Continue conversation with Cuzzo" })
    .click();
  await reply(page, "Let me think").click();
  await expect(modal(page)).toHaveCount(0);
  await nav(page, "Wallet");
  await endDay(page);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "City", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(modal(page)).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator(".day-transition")).toContainText("DAY 02");
  await page
    .getByRole("button", { name: "Continue conversation with Cuzzo" })
    .click();
  await reply(page, "I can’t get involved").click();
  await expect(modal(page)).toHaveCount(0);
  expect((await saved(page)).commitments).toHaveLength(0);
  await expect(page.getByRole("status")).toContainText("No promise");
  await endDay(page);
  await declineCrewOffer(page);
  await expect(modal(page)).toHaveCount(0);
});

for (const outcome of ["fulfilled", "broken"] as const)
  test(`40 days after ${outcome}: one storyline reaction while independent offers continue`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await seed(
      page,
      newGame("Test(3)", "south", outcome === "broken" ? 13 : 2026),
    );
    await reply(page, "I’ll help you").click();
    if (outcome === "fulfilled") {
      await nav(page, "Actions");
      await page.locator('[data-action="gig"]').getByRole("button").click();
      await storyline(page);
      await page
        .getByRole("dialog", { name: "Character encounter" })
        .getByRole("button", { name: /Pay to return the chains/ })
        .click();
    } else {
      for (let day = 2; day <= 9; day++) {
        await endDay(page);
        await declineCrewOffer(page);
        if (day < 9 && (await modal(page).count())) await acknowledge(page);
      }
    }
    await declineCrewOffer(page);
    await expect(modal(page)).toContainText(
      outcome === "broken" ? "I’m not forgetting it" : "came through",
    );
    expect(
      unseenEvents(await saved(page)).filter(
        (e) => e.incidentId === "the-chains",
      ),
    ).toHaveLength(1);
    if (outcome === "broken") await capture(page, "06-broken-promise-once");
    await acknowledge(page);
    await declineCrewOffer(page);
    await expect(modal(page)).toHaveCount(0);
    const past = await saved(page),
      historyCount = past.encounters.filter(
        (e) => !e.definitionId.startsWith("crew-"),
      ).length;
    for (let day = 0; day < 40; day++) {
      await endDay(page);
      await declineCrewOffer(page);
      await expect(modal(page)).toHaveCount(0);
    }
    const s = await saved(page);
    expect(
      s.encounters.filter((e) => !e.definitionId.startsWith("crew-")).length,
    ).toBe(historyCount);
    expect(incidentPromise(s, "the-chains")?.status).toBe(outcome);
    expect(
      s.characters.mega.memories.some((m) =>
        m.meaning.includes(
          outcome === "broken" ? "left me hanging" : "Kept the promise",
        ),
      ),
    ).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Resume saved game" }).click();
    await expect(modal(page)).toHaveCount(0);
    await nav(page, "Actions");
    await page.locator('[data-action="gig"]').getByRole("button").click();
    await expect(page.getByRole("status")).toContainText("$38");
    await nav(page, "City");
    if (outcome === "broken") await capture(page, "07-city-after-consequences");
  });

for (const width of [320, 375, 390, 430])
  test(`modal touch controls, focus and scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await seed(page);
    await expect(modal(page)).toBeVisible();
    const box = (await modal(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(740);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await modal(page).getByRole("button").all())
      expect(
        Math.round((await button.boundingBox())!.height),
      ).toBeGreaterThanOrEqual(44);
    const last = reply(page, "Let me think");
    await last.scrollIntoViewIfNeeded();
    const lastBox = (await last.boundingBox())!;
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(box.y + box.height);
    expect(
      (await new AxeBuilder({ page }).include(".encounter-modal").analyze())
        .violations,
    ).toEqual([]);
    await reply(page, "I’ll help you").click();
    await expect(modal(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).not.toBe(
      "fixed",
    );
  });

test("activity preserves chronology, true faction IDs, severity, private knowledge and routine detail", async ({
  page,
}) => {
  let s = newGame("Test(3)", "south");
  s = respondEncounter(s, s.encounters[0].id, "decline").state;
  record(s, "social", "An earlier major betrayal.", ["mega"], ["player"], {
    importance: "critical",
    title: "Broken word",
    factionId: "backstreet",
  });
  s = advanceDay(s);
  record(
    s,
    "social",
    "A newer personal conversation.",
    ["flacco"],
    ["player"],
    { importance: "personal" },
  );
  for (const factionId of Object.keys(s.factions) as FactionId[])
    record(s, "city", `Visible ${factionId} development.`, [], ["player"], {
      importance: "major",
      title: "Organization development",
      factionId,
    });
  record(s, "city", "PRIVATE GANG PLAN", ["pablo"], ["pablo"], {
    importance: "critical",
    factionId: "angels",
  });
  await seed(page, s);
  await expect(modal(page)).toHaveCount(0);
  await openJournal(page);
  const feed = page.locator(".timeline");
  await expect(feed).not.toContainText("PRIVATE GANG PLAN");
  for (const factionId of Object.keys(s.factions) as FactionId[]) {
    const event = feed
      .locator(`.event-major[data-faction="${factionId}"]`)
      .first();
    await expect(event).toBeVisible();
    expect(
      await event.evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--accent").trim(),
      ),
    ).toBe(THEMES[factionId].accent);
  }
  const ids = await feed
    .locator(".event-entry")
    .evaluateAll((nodes) =>
      nodes.map((el) => el.getAttribute("data-event-id")),
    );
  expect(ids).toEqual(
    s.events
      .filter(
        (e) => e.observedBy.includes("player") && e.importance !== "routine",
      )
      .slice(-80)
      .reverse()
      .map((e) => e.id),
  );
  await expect(feed.locator(".event-critical")).toContainText(
    "earlier major betrayal",
  );
  await feed.locator(".routine-summary summary").first().click();
  await expect(feed.locator(".routine-summary")).toContainText(
    "Gabriel’s Angels",
  );
  await feed.scrollIntoViewIfNeeded();
  await capture(page, "08-chronological-faction-activity");
});

test("queued simultaneous encounters are acknowledged in sequence without duplicate outcome banners", async ({
  page,
}) => {
  let s = newGame("Test(3)", "south");
  s = respondEncounter(s, s.encounters[0].id, "decline").state;
  record(
    s,
    "incident",
    "Pablo has heard about the robbery.",
    ["pablo"],
    ["player"],
    {
      importance: "major",
      title: "Leadership involved",
      incidentId: "the-chains",
    },
  );
  record(
    s,
    "incident",
    "Cuzzo is waiting for a response.",
    ["mega"],
    ["player"],
    {
      importance: "major",
      title: "A personal follow-up",
      incidentId: "the-chains",
    },
  );
  const { syncEncounters } = await import("../src/systems/Encounters");
  syncEncounters(s);
  await seed(page, s);
  await expect(modal(page)).toHaveCount(1);
  await expect(modal(page)).toContainText("Leadership involved");
  await acknowledge(page);
  await expect(modal(page)).toHaveCount(1);
  await expect(modal(page)).toContainText("personal follow-up");
  await acknowledge(page);
  await expect(modal(page)).toHaveCount(0);
  await expect(page.locator(".major-notification")).toHaveCount(0);
});

test("all homes and affiliation themes retain the City-only modal and normal navigation", async ({
  page,
}) => {
  const homes: ZoneId[] = ["downtown", "rio", "south", "reservoir", "nawf"];
  for (const [n, affiliation] of (
    [
      null,
      "angels",
      "backstreet",
      "blocks",
      "blips",
      "muds",
    ] as (FactionId | null)[]
  ).entries()) {
    const s = newGame("Test(3)", homes[n % 5]);
    s.characters.player.affiliation = affiliation;
    await seed(page, s);
    await expect(page.locator(".game-shell")).toHaveAttribute(
      "data-theme",
      affiliation ?? "independent",
    );
    await modal(page)
      .getByRole("button", { name: "Close conversation" })
      .click();
    for (const tab of ["Actions", "People", "Set", "Wallet"]) {
      await nav(page, tab);
      await expect(modal(page)).toHaveCount(0);
    }
    await endDay(page);
    await expect(modal(page)).toHaveCount(0);
    await expect(page.locator(".city-map")).toBeVisible();
  }
});
