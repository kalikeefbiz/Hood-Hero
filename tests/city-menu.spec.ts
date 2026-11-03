import { honest, connects, storyline, storyAction } from "./helpers";
import { dismissEncounter } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { newGame } from "../src/core/Simulation";
import { type GameState } from "../src/core/GameState";
import { SAVE_KEY, AUTO_KEY, serialize } from "../src/persistence/SaveSystem";
import { THEMES } from "../src/ui/theme";

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
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
  if (name === "Actions")
    await page.getByRole("button", { name: "Honest", exact: true }).click();
}

test("City centers the five state-backed neighborhoods and keeps actions in Actions", async ({
  page,
}, info) => {
  const state = newGame("Morgan", "south");
  await seed(page, state);
  const postDismiss = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
  const dock = page.getByRole("navigation");
  await expect(dock.getByRole("button")).toHaveText([
    "City",
    "People",
    "Actions",
    "Set",
    "Wallet",
    "Journal",
  ]);
  await expect(
    dock.getByRole("button", { name: "City", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".action-card, .today-moves")).toHaveCount(0);
  await expect(page.getByText("Today’s moves", { exact: true })).toHaveCount(0);
  const map = page.getByRole("group", {
    name: "Five neighborhoods of Stixx City",
  });
  await expect(map.getByRole("button")).toHaveCount(5);
  for (const zone of Object.values(state.zones)) {
    const button = map.getByRole("button", {
      name: `Select ${zone.name}`,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".zone-details h3")).toHaveText(zone.name);
    await expect(
      page.getByRole("meter", { name: "Police presence", exact: true }),
    ).toHaveAttribute("aria-valuenow", String(zone.police));
    await expect(
      page.getByRole("meter", { name: "Your local standing", exact: true }),
    ).toHaveAttribute(
      "aria-valuenow",
      String(state.characters.player.neighborhoodStanding[zone.id]),
    );
  }
  const nawf = map.getByRole("button", {
    name: "Select The Nawf",
    exact: true,
  });
  await nawf.focus();
  await page.keyboard.press("Enter");
  await expect(nawf).toHaveAttribute("aria-pressed", "true");
  await expect(nawf).toHaveAccessibleDescription(
    /No single controller.*The Blips.*Mudgang/,
  );
  // Shared presence: the chip carries both organizations' colors.
  expect(
    await nawf
      .locator(".chip-colors i")
      .evaluateAll((nodes) =>
        nodes.map((n) => getComputedStyle(n).backgroundColor),
      ),
  ).toHaveLength(2);
  void THEMES;
  await expect(page.locator(".zone-details")).toContainText(
    "No single controller",
  );
  const downtown = map.getByRole("button", {
    name: "Select Downtown",
    exact: true,
  });
  await downtown.focus();
  await page.keyboard.press(" ");
  await expect(downtown).toHaveAttribute("aria-pressed", "true");
  await expect(downtown).toHaveAccessibleDescription(
    /No single controller.*Unclaimed/,
  );
  await expect(page.locator(".zone-details .tags")).toHaveText("Unclaimed");
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
  expect(saved).toEqual(postDismiss); // Inspecting the map must never change ownership, membership, AP or saves.
  await expect(page.locator(".game-shell")).toHaveAttribute(
    "data-theme",
    "independent",
  );
  // The board is the City; history and standing live in the Journal.
  await nav(page, "Journal");
  await expect(
    page.getByRole("region", { name: "Activity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your position", exact: true }),
  ).toBeVisible();
  await nav(page, "Actions");
  await expect(page.locator('[data-action="apply"]').first()).toBeVisible();
  await expect(page.locator('[data-action="gig"]')).toHaveCount(1);
  await page
    .getByRole("button", { name: "Connects", exact: true })
    .filter({ hasNot: page.locator("svg") })
    .click();
  await expect(page.locator('[data-action="contact"]')).toHaveCount(1);
  await nav(page, "City");
  await page
    .getByRole("button", { name: "Select Southside", exact: true })
    .click();
  await page.evaluate(() => document.fonts.ready);
  for (const img of await page.locator("img:visible").all()) {
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("city-menu-390.png"),
    fullPage: true,
    scale: "css",
  });
  await info.attach("Updated City — 390px", {
    path: info.outputPath("city-menu-390.png"),
    contentType: "image/png",
  });
});

test("storyline uses the active demand and opens its existing City conversation", async ({
  page,
}) => {
  const state = newGame("Morgan", "south");
  state.incidents["the-chains"].informed = true;
  state.incidents["the-chains"].demand = 105;
  state.incidents["the-chains"].leadershipAware = true;
  await seed(page, state);
  const alert = page.getByRole("button", {
    name: "Open The Chains storyline",
    exact: true,
  });
  await expect(alert).toContainText("Demand $105");
  await expect(alert).toContainText("Leadership is considering its response");
  await alert.click();
  await expect(
    page.getByRole("dialog", { name: "Character encounter" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Character encounter" }),
  ).toContainText("$105");
  await expect(page.locator(".ap b")).toHaveText("2/2");
  for (const status of ["resolved", "abandoned", "missing"] as const) {
    if (status === "missing") {
      delete state.incidents["the-chains"];
      state.encounters = [];
    } else {
      state.incidents["the-chains"].status = status;
      state.incidents["the-chains"].resolution = "sold";
    }
    await seed(page, state);
    await expect(page.locator(".story-alert")).toHaveCount(0);
    await expect(page.locator(".city-map")).toBeVisible();
    if (status !== "missing") {
      await nav(page, "Journal");
      await page.getByText("Completed storylines", { exact: true }).click();
      await expect(page.locator(".situation-history")).toContainText(status);
      await expect(page.locator(".situation-history")).toContainText("sold");
    }
  }
});

test("City activity preserves visible history, reverse chronology, day groups, limits and filters", async ({
  page,
}) => {
  const state = newGame("Morgan", "south");
  state.day = 3;
  state.events = Array.from({ length: 82 }, (_, index) => ({
    id: `history-${index}`,
    day: index < 40 ? 1 : index < 80 ? 2 : 3,
    category: index % 2 ? "social" : "city",
    text: `History event ${index}`,
    actors: ["mega"],
    observedBy: ["player"],
  }));
  state.events.push({
    id: "private",
    day: 3,
    category: "city",
    text: "PRIVATE NPC ONLY",
    actors: ["mega"],
    observedBy: ["mega"],
  });
  await seed(page, state);
  await nav(page, "Journal");
  await expect(page.locator("main")).not.toContainText("PRIVATE NPC ONLY");
  const feed = page.locator(".timeline");
  await expect(feed.locator("article")).toHaveCount(80);
  await expect(feed.locator("article p").first()).toHaveText(
    "History event 81",
  );
  await expect(feed.locator("article p").last()).toHaveText("History event 2");
  await expect(feed.locator(".timeline-day")).toHaveText([
    "Day 03",
    "Day 02",
    "Day 01",
  ]);
  await page.getByRole("button", { name: "Your circle", exact: true }).click();
  await expect(feed.locator("article")).toHaveCount(41);
  await expect(feed.locator("article p").last()).toHaveText("History event 1");
  await expect(feed).not.toContainText("/ CITY");
  await nav(page, "People");
  await nav(page, "Journal");
  await expect(
    page.getByRole("button", { name: "Your circle", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "All activity", exact: true }).click();
  await expect(feed.locator("article")).toHaveCount(80);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).state.events,
      AUTO_KEY,
    ),
  ).toEqual(state.events);
});
