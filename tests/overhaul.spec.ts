import { openJournal } from "./journal";
import { honest, connects, storyline, storyAction } from "./helpers";
import { dismissEncounter } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { newGame } from "../src/core/Simulation";
import {
  player,
  type FactionId,
  type GameState,
  type ZoneId,
} from "../src/core/GameState";
import { serialize, SAVE_KEY, AUTO_KEY } from "../src/persistence/SaveSystem";
import { ZONES } from "../src/content/city";
import { THEMES } from "../src/ui/theme";

async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
  if (name === "Actions")
    await page.getByRole("button", { name: "Honest", exact: true }).click();
}
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
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function imagesLoaded(page: Page) {
  for (const image of await page.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("alt", /.+/);
    await expect
      .poll(() =>
        image.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth === 1448,
        ),
      )
      .toBe(true);
  }
}

test("all approved scenes load; every home starts independent and map selection cannot change affiliation", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await imagesLoaded(page);
  expect(await page.locator(".zone-choices img").count()).toBe(5);
  for (const z of Object.values(ZONES)) {
    await page.getByRole("radio", { name: new RegExp(z.name) }).check();
    await page.getByLabel("What do people call you?").fill(`From ${z.name}`);
    await page.getByRole("button", { name: "Enter Stixx City" }).click();
    await dismissEncounter(page);
    await expect(page.locator(".game-shell")).toHaveAttribute(
      "data-theme",
      "independent",
    );
    await expect(page.locator(".affiliation")).toHaveText("Independent");
    await expect(page.locator(".cash-resource strong")).toHaveText("$125");
    await expect(page.locator(".ap b")).toHaveText("2/2");
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator(".zone-details h3")).toHaveText(z.name);
    for (const zone of Object.values(ZONES)) {
      await page
        .getByRole("button", { name: `Select ${zone.name}`, exact: true })
        .click();
      await expect(page.locator(".zone-details h3")).toHaveText(zone.name);
      await expect(page.locator(".game-shell")).toHaveAttribute(
        "data-theme",
        "independent",
      );
    }
    await openJournal(page);
    await page.getByText("Game & save information", { exact: true }).click();
    await page.getByRole("button", { name: "New game menu" }).click();
  }
  expect(failures).toEqual([]);
});

for (const faction of [
  "angels",
  "blips",
  "muds",
  "backstreet",
  "blocks",
] as FactionId[]) {
  test(`valid sponsored ${faction} membership keeps the shell neutral and survives checkpoint reload`, async ({
    page,
  }) => {
    const state = newGame("Theme Check", "downtown");
    const sponsor = Object.values(state.characters).find(
      (c) => c.affiliation === faction && c.status === "active",
    )!;
    // Prepared eligible world, not a production debug path. The UI still must execute affiliate.
    const p = player(state);
    p.known = [...new Set([...p.known, sponsor.id])];
    p.connections = [...new Set([...p.connections, sponsor.id])];
    p.organizationStanding[faction] = 35;
    sponsor.relationships[p.id] = {
      trust: 35,
      respect: 10,
      affection: 0,
      grievance: 0,
      history: [],
    };
    await seed(page, state);
    await expect(page.locator(".game-shell")).toHaveAttribute(
      "data-theme",
      "independent",
    );
    await nav(page, "Actions");
    await page
      .getByRole("button", { name: "Connects", exact: true })
      .filter({ hasNot: page.locator("svg") })
      .click();
    await page.getByRole("combobox").selectOption(sponsor.id);
    const card = page.locator(".action-card").filter({
      has: page.getByRole("heading", { name: "Get put on", exact: true }),
    });
    await expect(card.getByRole("button")).toBeEnabled();
    await card.getByRole("button").click();
    await expect(page.locator(".game-shell")).toHaveAttribute(
      "data-theme",
      faction,
    );
    expect(
      await page
        .locator(".game-shell")
        .evaluate((el) => el.style.getPropertyValue("--accent")),
    ).toBe(THEMES.independent.accent);
    await expect(page.locator(".affiliation")).toHaveText(
      state.factions[faction].name,
    );
    await expect(page.locator(".ap b")).toHaveText("1/2");
    await page.getByRole("button", { name: "Save game", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Resume saved game" }).click();
    await dismissEncounter(page);
    await expect(page.locator(".game-shell")).toHaveAttribute(
      "data-theme",
      faction,
    );
    await expect(page.locator(".ap b")).toHaveText("1/2");
    await expect(page.locator(".home-label")).toContainText("Downtown");
  });
}

test("all destinations fit 320/375/390/430 and desktop, including long names and every dock target", async ({
  page,
}) => {
  await seed(page, newGame("A long player name for testing", "reservoir"));
  for (const width of [320, 375, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const screen of ["City", "People", "Actions", "Set", "Wallet"]) {
      await nav(page, screen);
      await noOverflow(page);
      const dock = page.getByRole("navigation");
      for (const button of await dock.getByRole("button").all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
    // The ledger's last item stays clear of the dock.
    await openJournal(page);
    {
      const dock = page.getByRole("navigation", { name: "Main navigation" });
      const menu = page.getByText("Game & save information", { exact: true });
      await menu.scrollIntoViewIfNeeded();
      expect((await menu.boundingBox())!.y + 44).toBeLessThanOrEqual(
        (await dock.boundingBox())!.y,
      );
    }
  }
});

test("Actions update cash/AP, explain disabled prerequisites, and autosave", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, newGame("Morgan", "rio"));
  await expect(page.locator(".action-card")).toHaveCount(0);
  await nav(page, "Actions");
  const card = page.locator(".action-card").filter({
    has: page.getByRole("heading", { name: "Pick up a gig", exact: true }),
  });
  const button = card.getByRole("button");
  await button.scrollIntoViewIfNeeded();
  const actionBox = (await button.boundingBox())!;
  const dockBox = (await page.getByRole("navigation").boundingBox())!;
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(dockBox.y);
  await button.click();
  await expect(page.locator(".cash-resource strong")).toHaveText("$163");
  await expect(page.locator(".ap b")).toHaveText("1/2");
  await expect(card.getByRole("button")).toBeDisabled();
  await expect(card.locator(".disabled-reason")).toContainText(
    "Today's local gig is complete",
  );
  await expect(card.getByRole("button")).toHaveAttribute(
    "aria-describedby",
    /reason/,
  );
  const auto = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
  expect(auto.ap).toBe(1);
  expect(auto.characters.player.wallet.clean).toBe(163);
});

test("directional trust, witnessed events, activity filters and day grouping preserve visibility", async ({
  page,
}) => {
  const s = newGame("Morgan", "south");
  s.characters.mega.relationships.player.trust = 72;
  player(s).relationships.mega.trust = 23;
  s.events.push({
    id: "private-fixture",
    day: 1,
    category: "city",
    text: "PRIVATE NPC ONLY",
    actors: ["mega"],
    observedBy: ["mega"],
  });
  s.events.push({
    id: "public-fixture",
    day: 1,
    category: "city",
    text: "Observed city decision",
    actors: ["mega"],
    observedBy: ["player"],
  });
  await seed(page, s);
  await openJournal(page);
  await expect(page.locator("main")).not.toContainText("PRIVATE NPC ONLY");
  await nav(page, "People");
  await expect(
    page.getByRole("meter", { name: "Their trust in you" }),
  ).toHaveAttribute("aria-valuenow", "72");
  await expect(
    page.getByRole("meter", { name: "Your trust in them" }),
  ).toHaveAttribute("aria-valuenow", "23");
  await expect(page.locator("main")).not.toContainText("PRIVATE NPC ONLY");
  await openJournal(page);
  await expect(
    page.getByRole("heading", { name: "Day 01", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".timeline")).toContainText(
    "Observed city decision",
  );
  await page.getByRole("button", { name: "Your circle", exact: true }).click();
  await expect(page.locator(".timeline")).not.toContainText(
    "Observed city decision",
  );
  await expect(page.locator("main")).not.toContainText("PRIVATE NPC ONLY");
});

test("negotiated demand comes from state; ended and damaged saves remain inspectable and safe", async ({
  page,
}) => {
  const s = newGame("Morgan", "nawf");
  s.incidents["the-chains"].informed = true;
  s.incidents["the-chains"].demand = 105;
  s.incidents["the-chains"].negotiated = true;
  await seed(page, s);
  await nav(page, "Actions");
  await storyline(page);
  await expect(
    page.getByRole("dialog", { name: "Character encounter" }),
  ).toContainText("$105");
  await expect(
    page.getByRole("button", { name: /Talk down the demand/ }),
  ).toHaveCount(0);
  s.end = "arrested";
  await seed(page, s);
  await expect(
    page.getByRole("heading", { name: "Your run ended: arrested" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "End day" })).toBeDisabled();
  await page.evaluate((key) => localStorage.setItem(key, "corrupt"), SAVE_KEY);
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Save could not be read",
  );
  await expect(
    page.getByRole("heading", { name: "Morgan", exact: true }),
  ).toBeVisible();
});
