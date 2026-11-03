import { honest, connects, storyline, storyAction } from "./helpers";
import { test, expect, type Page, type Dialog } from "@playwright/test";
import { AUTO_KEY, SAVE_KEY, serialize } from "../src/persistence/SaveSystem";
import { newGame } from "../src/core/Simulation";
import { advanceDay } from "../src/core/TimeSystem";
import { performAction } from "../src/core/ActionEngine";
import { respondEncounter, syncEncounters } from "../src/systems/Encounters";
import { record } from "../src/core/EventLog";
import type { GameState } from "../src/core/GameState";
const root = process.env.PLAYWRIGHT_BASE_PATH || "/";
const modal = (page: Page) =>
  page.getByRole("dialog", { name: "Character encounter", exact: true });
const nav = async (page: Page, name: string) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
  if (name === "Actions")
    await page.getByRole("button", { name: "Honest", exact: true }).click();
};
const state = async (page: Page): Promise<GameState> =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    AUTO_KEY,
  );
async function close(page: Page) {
  for (let i = 0; i < 8 && (await modal(page).count()); i++)
    await modal(page)
      .getByRole("button", { name: "Close conversation" })
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
  await close(page);
}
async function capture(page: Page, name: string) {
  const path = `docs/screenshots/goal-004/${test.info().project.name}-${name}.png`;
  await expect(page.locator(".action-feedback")).toHaveCount(0, {
    timeout: 7000,
  });
  const target = name.includes("job-search")
    ? page.locator('[data-action="apply"]').first()
    : /hired|wages|progression|restriction|tradeoff/.test(name)
      ? page.locator(".employment-summary")
      : name.includes("scheduled")
        ? page.locator('[data-action="work"]')
        : name.includes("termination")
          ? page.locator(".major-notification")
          : modal(page);
  if (await target.count()) {
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path, scale: "css", animations: "disabled" });
  } else await page.screenshot({ path, scale: "css", animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}
async function click(page: Page, type: string) {
  if (type === "rest") {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Actions", exact: true })
      .click();
  }
  if (["buyback", "negotiate", "recover", "settlement"].includes(type)) {
    await storyAction(page, type);
    return;
  }
  await page
    .locator(`[data-action="${type}"]`)
    .first()
    .getByRole("button")
    .click();
}
async function endDay(page: Page, accept = true) {
  const handle = (dialog: Dialog) =>
    accept ? dialog.accept() : dialog.dismiss();
  page.once("dialog", handle);
  await page.getByRole("button", { name: "End day" }).click();
  page.off("dialog", handle);
  await close(page);
}
test("hire, scheduled wages, save and a thirty-day employment playthrough", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(root);
  await page.getByLabel("What do people call you?").fill("Test(4)");
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await close(page);
  expect((await state(page)).characters.player.wallet.clean).toBe(125);
  await nav(page, "Actions");
  await expect(page.locator(".employment-summary")).toContainText("Unemployed");
  await expect(page.locator('[data-action="work"]')).toHaveCount(0);
  await capture(page, "01-job-search");
  await click(page, "apply");
  await click(page, "acceptJob");
  expect((await state(page)).employment[0].status).toBe("employed");
  await nav(page, "Wallet");
  await capture(page, "02-hired-schedule");
  for (let day = 1; day <= 30; day++) {
    let s = await state(page);
    const due = s.commitments.some(
      (c) =>
        c.kind === "employment-shift" &&
        c.dueDay === s.day &&
        c.status === "pending",
    );
    if (due) {
      await nav(page, "Actions");
      await click(page, "work");
      if (await modal(page).count())
        await modal(page)
          .getByRole("button", { name: /Skip scene/ })
          .click();
      s = await state(page);
      expect(s.ap).toBe(0);
      expect(s.employment[0].attendance.at(-1)?.status).toBe("worked");
      if (day === 2) {
        await nav(page, "Wallet");
        await capture(page, "03-first-wages");
      }
    } else {
      await nav(page, "Actions");
      await click(page, "rest");
    }
    await endDay(page);
  }
  const s = await state(page);
  expect(s.day).toBe(31);
  expect(s.employment[0].status).toBe("employed");
  expect(s.employment[0].wage).toBe(104);
  expect(
    s.employment[0].attendance.filter((a) => a.status === "missed"),
  ).toHaveLength(0);
  await nav(page, "Wallet");
  await capture(page, "04-reliable-progression");
  await page.getByLabel("Save game", { exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await close(page);
  expect((await state(page)).employment).toEqual(s.employment);
  expect(errors).toEqual([]);
});
test("absence warning can be cancelled; repeated absences fire and gigs survive cooldown", async ({
  page,
}) => {
  let s = newGame("Test(4)", "south");
  s = performAction(s, {
    type: "apply",
    actor: "player",
    jobId: "retail-south",
  }).state;
  s = performAction(s, {
    type: "acceptJob",
    actor: "player",
    jobId: "retail-south",
  }).state;
  s = advanceDay(s);
  await seed(page, s);
  await endDay(page, false);
  expect((await state(page)).day).toBe(2);
  await nav(page, "Actions");
  await page.locator('[data-action="work"]').scrollIntoViewIfNeeded();
  await capture(page, "05-scheduled-choice");
  for (let d = 2; d <= 6; d++) await endDay(page);
  s = await state(page);
  expect(s.employment[0].status).toBe("terminated");
  expect(s.employmentSearch.player.eligibleDay).toBe(13);
  await expect(page.locator(".major-notification")).toContainText(
    "Employment terminated",
  );
  await capture(page, "06-termination");
  await nav(page, "Wallet");
  await capture(page, "07-hiring-restriction");
  await nav(page, "Actions");
  for (const b of await page.locator('[data-action="apply"] button').all())
    await expect(b).toBeDisabled();
  await click(page, "gig");
  expect((await state(page)).progression.cleanEarned).toBe(38);
  await expect(page.locator('[data-action="gig"] button')).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await close(page);
  expect((await state(page)).employmentSearch.player.eligibleDay).toBe(13);
  while ((await state(page)).day < 13) await endDay(page);
  await nav(page, "Actions");
  await click(page, "apply");
  await click(page, "acceptJob");
  expect(
    (await state(page)).employment.filter((e) => e.status === "employed"),
  ).toHaveLength(1);
});
test("workplace scene consequence, skip, close and no replay across tabs or reload", async ({
  page,
}) => {
  let s = newGame("Test(4)", "south");
  s = performAction(s, {
    type: "apply",
    actor: "player",
    jobId: "retail-south",
  }).state;
  s = performAction(s, {
    type: "acceptJob",
    actor: "player",
    jobId: "retail-south",
  }).state;
  s = advanceDay(s);
  s = performAction(s, { type: "work", actor: "player" }).state;
  for (const e of s.encounters) {
    e.status = "closed";
  }
  record(
    s,
    "social",
    "Delivery count needs attention",
    ["player", "resident-south"],
    undefined,
    { title: "Difficult shift" },
  );
  syncEncounters(s);
  await seed(page, s);
  await nav(page, "City");
  await page
    .getByRole("button", { name: "Resume workplace conversation" })
    .click();
  await expect(modal(page)).toBeVisible();
  await capture(page, "08-workplace-choice");
  await modal(page)
    .getByRole("button", { name: /Fix it/ })
    .click();
  await expect(modal(page)).toHaveCount(0);
  const after = await state(page);
  expect(after.characters.player.stress).toBe(s.characters.player.stress + 6);
  expect(after.employment[0].performance).toBe(s.employment[0].performance + 1);
  for (const name of ["Actions", "Wallet", "City"]) {
    await nav(page, name);
    await expect(modal(page)).toHaveCount(0);
  }
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(modal(page)).toHaveCount(0);
  expect((await state(page)).progression.cleanEarned).toBe(
    s.progression.cleanEarned,
  );
  await capture(page, "09-scene-concluded");
});

test("employment competes with The Chains through actual AP, wages, attendance and promises", async ({
  page,
}) => {
  test.setTimeout(120000);
  let base = newGame("Test(4)", "south", 7);
  base = respondEncounter(
    base,
    base.encounters.find((e) => e.definitionId === "mega-chains-request")!.id,
    "promise",
  ).state;
  base = performAction(base, {
    type: "apply",
    actor: "player",
    jobId: "retail-south",
  }).state;
  base = performAction(base, {
    type: "acceptJob",
    actor: "player",
    jobId: "retail-south",
  }).state;
  base = performAction(base, { type: "gig", actor: "player" }).state;
  base = advanceDay(base);
  await seed(page, base);
  await nav(page, "Actions");
  await click(page, "work");
  if (await modal(page).count())
    await modal(page)
      .getByRole("button", { name: /Skip scene/ })
      .click();
  await nav(page, "Actions");
  await storyline(page);
  await expect(
    modal(page).getByRole("button", { name: /Pay to return the chains/ }),
  ).toBeDisabled();
  await close(page);
  await endDay(page);
  await nav(page, "Actions");
  await storyline(page);
  await click(page, "buyback");
  const worked = await state(page);
  expect(worked.incidents["the-chains"].resolution).toBe("buyback");
  expect(worked.employment[0].attendance[0].status).toBe("worked");
  expect(
    worked.commitments.find((c) => c.kind === "recover-property")?.status,
  ).toBe("fulfilled");
  await seed(page, base);
  await nav(page, "Actions");
  await click(page, "gig");
  await storyline(page);
  await click(page, "buyback");
  await close(page);
  await endDay(page);
  const helped = await state(page);
  expect(helped.employment[0].attendance[0].status).toBe("missed");
  expect(
    helped.commitments.find((c) => c.kind === "recover-property")?.status,
  ).toBe("fulfilled");
  expect(worked.characters.player.wallet.clean).toBeGreaterThan(
    helped.characters.player.wallet.clean,
  );
  expect(
    worked.characters[worked.employment[0].employer].relationships.player.trust,
  ).toBeGreaterThan(
    helped.characters[helped.employment[0].employer].relationships.player.trust,
  );
  await nav(page, "Wallet");
  await capture(page, "10-chains-attendance-tradeoff");
});
