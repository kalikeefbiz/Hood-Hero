import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { newGame } from "../src/core/Simulation";
import { incidentPromise } from "../src/systems/Commitments";
import { serialize, SAVE_KEY, AUTO_KEY } from "../src/persistence/SaveSystem";
import type { GameState, ZoneId, FactionId } from "../src/core/GameState";
const root = process.env.PLAYWRIGHT_BASE_PATH || "/";
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function seed(page: Page, s: GameState) {
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
const scene = (page: Page) =>
  page.getByRole("region", { name: "Character encounter", exact: true });
const response = (page: Page, text: string) =>
  scene(page).getByRole("button", { name: text, exact: false });
async function loadedImages(page: Page) {
  for (const img of await page.locator("img:visible").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
}
async function snapshot(page: Page, name: string, target = scene(page)) {
  await loadedImages(page);
  await page.evaluate(() => document.fonts.ready);
  const path =
    test.info().project.name === "chromium-mobile"
      ? `docs/screenshots/goal-003/${name}.png`
      : test.info().outputPath(`${name}.png`);
  await target.screenshot({ path, animations: "disabled", scale: "css" });
  await test.info().attach(name, { path, contentType: "image/png" });
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
}
async function acknowledgeAll(page: Page) {
  while (
    await page.getByRole("region", { name: "Important developments" }).count()
  ) {
    await page
      .getByRole("button", { name: "Acknowledge", exact: true })
      .click();
  }
}
test("A/E: new-game conversation, promise, actual buyback, reaction, save and normal city", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(root);
  await page.getByLabel("What do people call you?").fill("Test(3)");
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await expect(scene(page)).toContainText("I was out with my girl");
  await expect(scene(page).getByRole("img")).toHaveAttribute(
    "src",
    /mega-concerned-no-chain.webp$/,
  );
  await expect(
    scene(page)
      .getByRole("group", { name: "Your response" })
      .getByRole("button"),
  ).toHaveCount(4);
  await snapshot(page, "01-opening-and-responses");
  await response(page, "Tell me what happened").click();
  await expect(scene(page)).toContainText("This wasn’t authorized");
  await expect(page.locator(".ap b")).toHaveText("2/2");
  await response(page, "I’ll help you get it back").click();
  await expect(scene(page)).toContainText("Before day 9 begins");
  await expect(
    page.getByRole("region", { name: "Your promises" }),
  ).toContainText("8 days remaining");
  await expect(response(page, "Pay to return")).toBeDisabled();
  await snapshot(page, "02-accepted-deadline-and-actions");
  await page.getByLabel("Save game", { exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(scene(page)).toContainText("Your word · pending");
  await expect(response(page, "I’ll help you")).toHaveCount(0);
  await scene(page).getByRole("button", { name: "Close conversation" }).click();
  await nav(page, "Actions");
  await page.locator('[data-action="gig"]').getByRole("button").click();
  await page.getByRole("button", { name: "The Chains", exact: true }).click();
  await page
    .getByRole("button", { name: "Talk with Cuzzo", exact: false })
    .click();
  await snapshot(page, "03-follow-up-actions");
  await snapshot(
    page,
    "10-incident-art-and-known-participants",
    page.locator(".story-evidence"),
  );
  await response(page, "Pay to return").click();
  await expect(scene(page)).toContainText("You came through for me");
  await expect(scene(page).getByRole("img")).toHaveAttribute(
    "src",
    /mega-confident-with-chain.webp$/,
  );
  await expect(
    page.getByRole("region", { name: "Important developments" }),
  ).toContainText("You kept your word");
  expect(incidentPromise(await saved(page), "the-chains")?.status).toBe(
    "fulfilled",
  );
  await snapshot(page, "04-resolved-correct-art");
  await snapshot(
    page,
    "05-fulfilled-notification",
    page.getByRole("region", { name: "Important developments" }),
  );
  await acknowledgeAll(page);
  // Resume must prefer the acknowledged autosave over the earlier promise checkpoint.
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(scene(page)).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Important developments" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "End day" }).click();
  await nav(page, "Actions");
  await page.locator('[data-action="work"]').getByRole("button").click();
  await nav(page, "City");
  await page.getByText("Important outcomes", { exact: false }).click();
  const before = await saved(page);
  await page
    .getByRole("button", { name: "Revisit Cuzzo’s reaction", exact: true })
    .first()
    .click();
  await expect(scene(page)).toContainText("came through");
  const after = await saved(page);
  expect(after.characters.mega.relationships).toEqual(
    before.characters.mega.relationships,
  );
  expect(after.rng).toBe(before.rng);
  await scene(page).getByRole("button", { name: "Close conversation" }).click();
  await page.getByText("Important outcomes", { exact: false }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    fullPage: true,
    scale: "css",
    path:
      test.info().project.name === "chromium-mobile"
        ? "docs/screenshots/goal-003/08-playable-city.png"
        : test.info().outputPath("playable-city.png"),
  });
  expect(errors).toEqual([]);
});
test("B: neglect produces a visible warning, broken promise and continued play", async ({
  page,
}) => {
  await seed(page, newGame("Test(3)", "south", 83));
  await response(page, "I’ll help you").click();
  for (let day = 2; day <= 9; day++)
    await page.getByRole("button", { name: "End day" }).click();
  await expect(
    page.getByRole("region", { name: "Important developments" }),
  ).toContainText("You left Cuzzo hanging");
  await expect(scene(page)).toContainText("I’m not forgetting it");
  await expect(scene(page).getByRole("img")).toHaveAttribute(
    "src",
    /concerned-no-chain.webp$/,
  );
  expect(incidentPromise(await saved(page), "the-chains")?.status).toBe(
    "broken",
  );
  await snapshot(page, "06-broken-promise-reaction");
  await snapshot(
    page,
    "07-broken-promise-notification",
    page.getByRole("region", { name: "Important developments" }),
  );
  await nav(page, "Actions");
  await page.getByRole("button", { name: "Everyday", exact: true }).click();
  await page.locator('[data-action="work"]').getByRole("button").click();
  await expect(page.locator(".ap b")).toHaveText("0/2");
  await acknowledgeAll(page);
  await page.getByLabel("Save game", { exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(
    page.getByRole("region", { name: "Important developments" }),
  ).toHaveCount(0);
});
test("C/D: refusing and autonomous settlement never give betrayal or accomplishment credit", async ({
  page,
}) => {
  await seed(page, newGame("Test(3)", "south"));
  await response(page, "I can’t get involved").click();
  await expect(scene(page)).toContainText("I heard you");
  await scene(page).getByRole("button", { name: "Close conversation" }).click();
  for (let n = 0; n < 9; n++)
    await page.getByRole("button", { name: "End day" }).click();
  const s = await saved(page);
  expect(s.commitments).toHaveLength(0);
  expect(s.incidents["the-chains"].resolution).toBe("settlement");
  expect(s.characters.player.influence).toBe(0);
  await expect(
    page.getByRole("region", { name: "Important developments" }),
  ).toBeVisible();
  await expect(scene(page)).not.toContainText("came through");
});
test("player-prompted leadership uses normal AP and produces a fulfilled promise", async ({
  page,
}) => {
  await seed(page, newGame("Test(3)", "south", 20));
  await response(page, "I’ll help you").click();
  await response(page, "Bring the dispute to Pablo").click();
  await expect(page.locator(".ap b")).toHaveText("1/2");
  for (let day = 0; day < 8; day++)
    await page.getByRole("button", { name: "End day" }).click();
  const s = await saved(page);
  expect(s.incidents["the-chains"].resolvedBy).toBe("pablo");
  expect(incidentPromise(s, "the-chains")?.status).toBe("fulfilled");
});
for (const width of [320, 375, 390, 430])
  test(`touch layout, art and accessibility at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await seed(page, newGame("Test(3)", "resevoir"));
    await loadedImages(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await scene(page).getByRole("button").all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const lastReply = scene(page)
      .getByRole("group", { name: "Your response" })
      .getByRole("button")
      .last();
    await lastReply.scrollIntoViewIfNeeded();
    const replyBox = (await lastReply.boundingBox())!,
      dockBox = (await page.getByRole("navigation").boundingBox())!;
    expect(replyBox.y + replyBox.height).toBeLessThanOrEqual(dockBox.y);
    const issues = await new AxeBuilder({ page })
      .include(".encounter-scene")
      .analyze();
    expect(issues.violations).toEqual([]);
    await response(page, "I’ll help you").click();
    await nav(page, "Actions");
    await page.getByRole("button", { name: "The Chains", exact: true }).click();
    await loadedImages(page);
    for (const img of await page.locator(".story-evidence img").all())
      expect(await img.getAttribute("src")).toContain(`${root}assets/`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await nav(page, "People");
    await expect(
      page.locator(".profile .character-portrait img"),
    ).toHaveAttribute("src", /no-chain.webp$/);
    await page.getByRole("button", { name: /Flacco.*Civilian/ }).click();
    await expect(page.locator(".profile .character-placeholder")).toBeVisible();
  });
test("all homes and affiliation themes retain navigation, scene and state-correct portraits", async ({
  page,
}) => {
  const homes: ZoneId[] = ["downtown", "rio", "south", "resevoir", "nawf"];
  const affiliations: (FactionId | null)[] = [
    null,
    "angels",
    "backstreet",
    "blocks",
    "blips",
    "muds",
  ];
  for (const [n, affiliation] of affiliations.entries()) {
    const s = newGame("Test(3)", homes[n % 5]);
    s.characters.player.affiliation = affiliation;
    await seed(page, s);
    await expect(page.locator(".game-shell")).toHaveAttribute(
      "data-theme",
      affiliation ?? "independent",
    );
    await expect(scene(page)).toBeVisible();
    await nav(page, "Actions");
    await expect(page.locator('[data-action="work"]')).toBeVisible();
    await nav(page, "City");
    await expect(page.locator(".city-map")).toBeVisible();
  }
});
test("an incompatible old development save explains how to start a new run", async ({
  page,
}) => {
  const s = newGame("Test(1)", "south");
  await page.goto(root);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: SAVE_KEY,
    raw: JSON.stringify({ format: "syndicate", version: 1, state: s }),
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(page.getByRole("status")).toContainText("Start a new test run");
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await expect(scene(page)).toBeVisible();
});

test("individual approved portraits and image failure fallback", async ({
  page,
}) => {
  await seed(page, newGame("Test(3)", "south"));
  await nav(page, "People");
  for (const [name, file] of [
    ["Dizzy", "dizzy"],
    ["Baby Canon", "baby-canon"],
    ["Joker", "joker"],
  ]) {
    await page.locator(".person-row").filter({ hasText: name }).click();
    await loadedImages(page);
    await expect(
      page.locator(".profile .character-portrait img"),
    ).toHaveAttribute("src", new RegExp(`${file}-portrait.webp$`));
  }
  await page.route("**/mega-*.webp", (route) => route.abort());
  // A new document clears WebKit’s in-memory image reuse before testing failure.
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await nav(page, "People");
  await page.locator(".person-row").filter({ hasText: "Cuzzo" }).click();
  await expect(page.locator(".profile .character-placeholder")).toBeVisible();
});
test("desktop scene preserves art, responsive composition and normal actions", async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await seed(page, newGame("Test(3)", "rio"));
  await response(page, "I’ll help you").click();
  await loadedImages(page);
  const portrait = await scene(page)
    .locator(".character-portrait")
    .boundingBox();
  const dialogue = await scene(page).locator(".dialogue").boundingBox();
  expect(portrait!.x).toBeLessThan(dialogue!.x);
  await snapshot(page, "09-desktop-encounter");
  await nav(page, "Actions");
  await expect(page.locator('[data-action="work"]')).toBeVisible();
  await page.close();
});

test("opening only loads the requested character illustration", async ({
  page,
}) => {
  const portraits: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/assets/characters/")) portraits.push(r.url());
  });
  await page.goto(root);
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await loadedImages(page);
  expect(portraits.length).toBe(1);
  expect(portraits[0]).toContain("mega-concerned-no-chain.webp");
});
