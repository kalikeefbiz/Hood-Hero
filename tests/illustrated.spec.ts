import { test, expect, type Page } from "@playwright/test";
import { newGame } from "../src/core/Simulation";
import {
  performAction,
  ACTIONS,
  type ActionType,
} from "../src/core/ActionEngine";
import { player, type GameState } from "../src/core/GameState";
import { serialize, SAVE_KEY } from "../src/persistence/SaveSystem";

const base = process.env.PLAYWRIGHT_BASE_PATH || "/";
const scenes = {
  work: "clock-in",
  standing: "build-local-connection",
  rest: "quiet-afternoon",
  crime: "black-market-opportunity",
  inquire: "ask-around",
};
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
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function loaded(page: Page, id: keyof typeof scenes) {
  const card = page.locator(`.action-card[data-action="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  const img = card.locator(".action-scene");
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute(
    "src",
    `${base}assets/actions/${scenes[id]}-480.webp`,
  );
  await expect
    .poll(() =>
      img.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    )
    .toBe(true);
  expect(
    await img.evaluate(
      (el: HTMLImageElement) => new URL(el.currentSrc).pathname,
    ),
  ).toMatch(
    new RegExp(`^${base}assets/actions/${scenes[id]}-(480|960)\\.webp$`),
  );
  return card;
}

test("approved art maps to real actions and resolves under the production base", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await seed(page, newGame("Morgan", "south"));
  await expect(page.locator(".tile-work .action-scene")).toHaveAttribute(
    "src",
    `${base}assets/actions/clock-in-480.webp`,
  );
  await expect(page.locator(".tile-gig img, .tile-contact img")).toHaveCount(0);
  await nav(page, "Actions");
  for (const id of ["work", "rest", "crime"] as const) {
    const card = await loaded(page, id);
    await expect(card.locator(".ap-cost")).toHaveText(`${ACTIONS[id].ap} AP`);
    await expect(card.locator(".risk")).toHaveText(
      id === "crime" ? "HIGH RISK" : "NO RISK",
    );
    await expect(card).toContainText(ACTIONS[id].description);
    for (const outcome of ACTIONS[id].outcomes)
      await expect(card).toContainText(outcome);
  }
  await expect(page.locator('[data-action="gig"] img')).toHaveCount(0);
  await page
    .getByRole("button", { name: "People", exact: true })
    .filter({ hasNot: page.locator("svg") })
    .click();
  await page.getByRole("combobox").selectOption("mega");
  await loaded(page, "inquire");
  await loaded(page, "standing");
  for (const id of [
    "contact",
    "introduce",
    "socialize",
    "affiliate",
  ] as ActionType[]) {
    await expect(page.locator(`[data-action="${id}"] img`)).toHaveCount(0);
  }
  expect(failures).toEqual([]);
});

test("action art loads near the viewport, and failed art preserves layout and gameplay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requested: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/assets/actions/")) requested.push(r.url());
  });
  await seed(page, newGame("Morgan", "south"));
  await expect(page.locator(".tile-work .action-scene")).toBeVisible();
  expect(requested.every((url) => url.includes("clock-in"))).toBe(true);
  const before = requested.length;
  await nav(page, "Actions");
  await expect(
    page.locator('[data-action="work"] .action-scene'),
  ).toBeVisible();
  expect(
    requested
      .slice(before)
      .some((url) =>
        /quiet-afternoon|black-market|ask-around|build-local/.test(url),
      ),
  ).toBe(false);
  await loaded(page, "rest");
  expect(requested.some((url) => url.includes("quiet-afternoon"))).toBe(true);

  await nav(page, "City");
  const loadedSize = (await page.locator(".tile-work").boundingBox())!;
  await page.route("**/assets/actions/**", (route) => route.abort());
  // A new document discards the image cache as well as the UI's loaded state.
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  const work = page.locator(".tile-work");
  await expect(work.locator(".action-art-fallback")).toBeVisible();
  const size = await work.boundingBox();
  expect(size!.height).toBe(loadedSize.height);
  expect(size!.width).toBe(loadedSize.width);
  await work.getByRole("button").click();
  await expect(page.locator(".cash-resource strong")).toHaveText("$221");
  await expect(page.locator(".ap b")).toHaveText("0/2");
  await expect(work.getByRole("button")).toBeDisabled();
  await expect(work.locator(".disabled-reason")).toHaveText(
    "Not enough AP or availability",
  );
  expect((await work.boundingBox())!.width).toBe(size!.width);
});

test("GOAL 002C mobile visual review and usable narrow controls", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  async function capture(name: string, fullPage = false, resetScroll = true) {
    await page.evaluate(() => document.fonts.ready);
    // Wait for the observer to mount near-viewport images before enumerating img.
    // WebKit can take another frame between fonts settling and that React update.
    for (const frame of await page.locator(".action-artwork").all()) {
      const box = await frame.boundingBox();
      const height = page.viewportSize()!.height;
      if (!box || (!fullPage && (box.y >= height || box.y + box.height <= 0)))
        continue;
      if (resetScroll || fullPage) await frame.scrollIntoViewIfNeeded();
      await expect(frame.locator("img")).toBeVisible();
      await expect
        .poll(() =>
          frame
            .locator("img")
            .evaluate(
              (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
            ),
        )
        .toBe(true);
    }
    for (const img of await page.locator("img:visible").all()) {
      if (resetScroll) await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    if (resetScroll) await page.evaluate(() => scrollTo(0, 0));
    const path = info.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage, scale: "css" });
    await info.attach(name, { path, contentType: "image/png" });
  }
  await seed(page, newGame("Morgan", "south"));
  await capture("01-independent-city-390");
  await nav(page, "Actions");
  // Scroll each approved card into view so the full-page review includes loaded art.
  for (const id of ["work", "rest", "crime"] as const) await loaded(page, id);
  await capture("02-everyday-actions-390", true);
  await page.setViewportSize({ width: 320, height: 700 });
  await capture("04-everyday-actions-320", true);
  await nav(page, "City");
  await capture("04-city-320");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const control of await page
    .locator(".quick-moves button, .quick-moves summary, .bottom-nav button")
    .all()) {
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.evaluate(() => scrollTo(0, 190));
  for (const control of await page.locator(".quick-moves button").all()) {
    const box = (await control.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(
      (await page.locator(".bottom-nav").boundingBox())!.y,
    );
  }
  await capture("04b-city-controls-320", false, false);
  // Review a real membership result restored from a compatible save.
  const s = newGame("Morgan", "nawf");
  const p = player(s);
  const sponsor = Object.values(s.characters).find(
    (c) => c.affiliation === "blips" && c.status === "active",
  )!;
  p.known = [...new Set([...p.known, sponsor.id])];
  p.organizationStanding.blips = 35;
  sponsor.relationships.player = {
    trust: 35,
    respect: 10,
    affection: 0,
    grievance: 0,
    history: [],
  };
  const result = performAction(s, {
    type: "affiliate",
    actor: "player",
    target: sponsor.id,
  });
  expect(result.error).toBeNull();
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, result.state);
  await expect(page.locator(".game-shell")).toHaveAttribute(
    "data-theme",
    "blips",
  );
  await capture("03-blips-city-390");
  await nav(page, "Actions");
  await page
    .getByRole("button", { name: "People", exact: true })
    .filter({ hasNot: page.locator("svg") })
    .click();
  await page.getByRole("combobox").selectOption(sponsor.id);
  await loaded(page, "inquire");
  await loaded(page, "standing");
  await capture("05-people-actions-390", true);
  if (info.project.name === "chromium-mobile") {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 47, bottom: 34, left: 0, right: 0 },
    });
    await nav(page, "City");
    expect(
      await page
        .locator(".game-header")
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop)),
    ).toBe(51);
    expect(
      await page
        .locator(".bottom-nav")
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
    ).toBe(34);
    await capture("06-city-safe-area-390");
    const control = page.locator(".tile-gig button");
    await control.scrollIntoViewIfNeeded();
    const box = (await control.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(
      (await page.locator(".bottom-nav").boundingBox())!.y,
    );
    await control.click();
    await expect(page.locator(".ap b")).toHaveText("0/2");
  }
});
