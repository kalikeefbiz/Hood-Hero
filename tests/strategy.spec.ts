import { test, expect, type Page } from "@playwright/test";
import { newGame } from "../src/core/Simulation";
import { advanceDay } from "../src/core/TimeSystem";
import { performAction } from "../src/core/ActionEngine";
import { serialize, SAVE_KEY } from "../src/persistence/SaveSystem";
import { underlordReady, consolidate } from "../src/tests/strategicFixtures";
import { businessAction } from "../src/systems/Businesses";
import { politicalAction } from "../src/systems/Politics";
import { connect } from "../src/systems/Relationships";
import type { GameState } from "../src/core/GameState";
import { dismissEncounter } from "./helpers";
const base = process.env.PLAYWRIGHT_BASE_PATH || "/";
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function seed(page: Page, s: GameState) {
  await page.goto(base);
  await page.evaluate(
    ({ key, raw }) => {
      localStorage.clear();
      localStorage.setItem(key, raw);
    },
    { key: SAVE_KEY, raw: serialize(s) },
  );
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await dismissEncounter(page);
}
async function shot(page: Page, selector: string, name: string) {
  await page.locator(selector).screenshot({
    path: `docs/screenshots/goal-007/${process.env.PLAYWRIGHT_PUBLIC_URL ? "live-" : ""}${test.info().project.name}-${name}.png`,
    animations: "disabled",
    scale: "css",
  });
}
async function verifyBuild(page: Page) {
  if (process.env.PLAYWRIGHT_EXPECTED_COMMIT) {
    const r = await page.request.get(`${base}build-info.json?v=${Date.now()}`);
    const b = await r.json();
    expect(b.commit).toBe(process.env.PLAYWRIGHT_EXPECTED_COMMIT);
    expect(b.milestone).toBe("GOAL 007");
    expect(b.saveSchema).toBe(8);
  }
}
test.beforeEach(async ({ page }) => verifyBuild(page));
test("actual local investment, contested map, autonomous decisions and persisted continuation", async ({
  page,
}) => {
  await page.goto(base);
  await page.getByLabel("What do people call you?").fill("Test(7) Local");
  await page.getByRole("radio", { name: "Southside", exact: false }).check();
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await dismissEncounter(page);
  await page.locator(".strategic-actions summary").click();
  await page.getByRole("button", { name: /Build Community Support/ }).click();
  await expect(page.locator(".strategy-neighborhood")).toContainText(
    "Civilian climate 48",
  );
  await shot(page, ".zone-details", "05-strategic-action");
  await page
    .getByRole("button", { name: "Select The Nawf", exact: true })
    .click();
  await expect(page.locator(".strategy-neighborhood")).toContainText(
    "Contested neighborhood",
  );
  await shot(page, ".city-layout", "02-contested-neighborhood");
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await shot(page, ".board-stage", "01-dynamic-map");
  const raw = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("blackhouse.hoodhero-lab.v1.auto")!).state,
  );
  expect(
    Object.values(raw.strategic.strategies).some((x: any) => x.history.length),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Select Southside", exact: true })
    .click();
  await page
    .locator(".strategy-neighborhood details")
    .last()
    .getByText("Recent faction decisions")
    .click();
  await shot(page, ".strategy-neighborhood", "09-faction-development");
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await dismissEncounter(page);
  await expect(page.locator(".game-shell")).toBeVisible();
});
test("simulation-resolved control change and council succession progression", async ({
  page,
}) => {
  const s = underlordReady();
  await seed(page, s);
  await page
    .getByRole("button", { name: "Select Downtown", exact: true })
    .click();
  await expect(page.locator(".control-label")).toContainText("Gabriel");
  await shot(page, ".city-layout", "03-control-change");
  await nav(page, "Set");
  await expect(page.locator(".organization-panel")).toContainText(
    "4/4 stabilized",
  );
  await page.getByText("Successor eligibility", { exact: true }).click();
  await expect(page.locator(".organization-panel")).toContainText(
    "Eligible to accept",
  );
  await shot(page, ".organization-panel", "07-underlord-successor");
  await page.getByRole("button", { name: /Appoint Joker/ }).click();
  await expect(page.locator(".ending")).toContainText("underlord");
});
test("earned affiliation authority restriction and advancement use existing sponsorship", async ({
  page,
}) => {
  let s = newGame("Test(7) Advancement", "south");
  s.day = 15;
  s.characters.player.affiliation = "backstreet";
  s.characters.player.authority = 10;
  s.characters.player.organizationStanding.backstreet = 55;
  s.strategic.membershipDay = 1;
  s.strategic.contributions.backstreet = 120;
  s.factions.backstreet.instability = 50;
  connect(s, "player", "justice");
  s.characters.justice.relationships.player.trust = 60;
  await seed(page, s);
  await nav(page, "Set");
  await page
    .getByRole("button", { name: "Request advancement · 1 AP" })
    .click();
  await expect(page.locator(".organization-panel")).toContainText(
    "Contributor",
  );
  await expect(page.locator(".organization-panel")).toContainText(
    "Authority 25",
  );
  await shot(page, ".organization-panel", "04-organization-progression");
});
test("business acquisition, real operating income, sale, and voluntary retirement", async ({
  page,
}) => {
  let s = newGame("Test(7) Business", "south");
  s.characters.player.wallet.clean = 3000;
  s.characters.player.legitimacy = 30; // controlled financial setup, production acquisition and daily operation
  await seed(page, s);
  await nav(page, "Wallet");
  await page.getByRole("button", { name: /Acquire Southside repair/ }).click();
  await expect(page.locator(".business-panel")).toContainText("Funding: clean");
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await nav(page, "Wallet");
  await expect(page.locator(".business-panel")).toContainText("Latest net");
  await page.getByText("Operating history", { exact: true }).click();
  await shot(page, ".business-panel", "06-business-income");
  await shot(page, ".retirement-panel", "08-legitimate-progress");
  await page.getByRole("button", { name: /Sell .*repair counter/ }).click();
  await expect(page.locator(".business-panel")).toContainText("sold");
  // Distant clean-wealth fixture; sustainable income comes from actual operating business history.
  s = newGame("Test(7) Retirement", "south");
  s.characters.player.wallet.clean = 120000;
  s.characters.player.legitimacy = 60;
  s = businessAction(s, "laundry", "buy").state;
  for (let d = 0; d < 35; d++) s = advanceDay(s);
  await seed(page, s);
  await nav(page, "Wallet");
  await expect(
    page.getByRole("button", { name: "Retire voluntarily" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Retire voluntarily" }).click();
  await expect(page.locator(".ending")).toContainText("legitimate-exit");
});
for (const width of [320, 375, 390, 430])
  test(`strategy, organization and businesses fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await seed(page, underlordReady());
    for (const screen of ["City", "Set", "Wallet"]) {
      await nav(page, screen);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
