import { honest, connects, storyline, storyAction } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { dismissEncounter } from "./helpers";
const key = "blackhouse.hoodhero-lab.v1.auto";
async function state(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state, key);
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
  if (name === "Actions")
    await page.getByRole("button", { name: "Honest", exact: true }).click();
}
async function start(page: Page) {
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await page.getByLabel("What do people call you?").fill("Test(5)");
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await dismissEncounter(page);
}
async function day(page: Page) {
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
}
async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `docs/screenshots/goal-005/${test.info().project.name}-${name}.png`,
    fullPage: false,
  });
}
async function interact(page: Page, name = "Flacco") {
  await nav(page, "Set");
  await page
    .getByRole("button", { name: `Interact with ${name}`, exact: true })
    .click();
}
async function card(page: Page, label: string) {
  await page
    .locator(".action-card")
    .filter({ has: page.getByRole("heading", { name: label, exact: true }) })
    .getByRole("button")
    .click();
}

test("Flacco cooperation, paid work, refusal, natural second recruitment and saved consequences", async ({
  page,
}) => {
  test.setTimeout(test.info().project.name.includes("webkit") ? 180000 : 90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await interact(page);
  const modal = page.getByRole("dialog", { name: "Character encounter" });
  await expect(modal).toContainText("Flacco");
  await expect(modal).toContainText("Work: learning");
  await snap(page, "01-flacco-interaction");
  await modal
    .locator(".encounter-responses")
    .evaluate((e) => (e.scrollTop = e.scrollHeight));
  await snap(page, "02-cooperation-options");
  await modal.getByRole("button", { name: /^Paid local work/ }).click();
  await expect(modal).toHaveCount(0);
  await nav(page, "Set");
  await expect(page.locator("main")).toContainText("active");
  await page
    .getByText(/Flacco · Paid local work · active/)
    .scrollIntoViewIfNeeded();
  await snap(page, "03-accepted-assignment");
  const accepted = await state(page);
  expect(accepted.ap).toBe(1);
  expect(accepted.characters.player.wallet.clean).toBe(113);
  await interact(page);
  await modal.getByRole("button", { name: /^Spend time together/ }).click();
  await nav(page, "Set");
  await expect(page.locator("main")).toContainText("No new obligation");
  await page
    .getByText(/No new obligation/)
    .last()
    .scrollIntoViewIfNeeded();
  await snap(page, "04-refused-request");
  expect((await state(page)).ap).toBe(1);
  await day(page);
  await nav(page, "Set");
  await expect(page.locator("main")).toContainText("Paid local work:");
  await page.getByText(/Flacco · Paid local work:/).scrollIntoViewIfNeeded();
  await snap(page, "07-completed-assignment");
  // Earn trust and the second slot entirely through the real UI and AP budget.
  for (let i = 0; i < 12; i++) {
    const s = await state(page);
    if (
      s.crew.capacity >= 2 &&
      s.characters["resident-south"].relationships.player.trust >= 42
    )
      break;
    if (!s.ap) await day(page);
    await nav(page, "Set");
    await page
      .getByRole("button", {
        name: "Build relationship with Robin",
        exact: true,
      })
      .click();
    await card(page, "Spend time together");
  }
  if (!(await state(page)).ap) await day(page);
  await nav(page, "Set");
  await page
    .locator(".recruit-row")
    .filter({ has: page.getByText("Robin", { exact: true }) })
    .getByRole("button", { name: "Invite", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("2/2 MEMBERS");
  await expect(
    page.getByRole("button", { name: "Interact with Robin", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Interact with Robin", exact: true })
    .scrollIntoViewIfNeeded();
  await snap(page, "06-second-member");
  const s = await state(page);
  expect(s.characters["resident-south"].skills.work).toBeGreaterThan(
    s.characters.flacco.skills.work,
  );
  await page.getByLabel("Save game", { exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await dismissEncounter(page);
  expect((await state(page)).assignments).toEqual(s.assignments);
  expect(errors).toEqual([]);
});

test("independent offer: inspect, accept, attend, decline and expire while the NPC keeps acting", async ({
  page,
}) => {
  // Plays up to 40 days on the software renderer; it already ran ~117s of a
  // 120s budget before the GLB models, so give it real headroom.
  test.setTimeout(180000);
  await start(page);
  const modal = page.getByRole("dialog", { name: "Character encounter" });
  let accepted = false,
    completed = false,
    declined = false,
    expired = false;
  for (let i = 0; i < 40; i++) {
    let s = await state(page);
    const offer = s.crewOffers.find((o: any) => o.status === "pending");
    if (offer && (!accepted || !declined)) {
      await nav(page, "Set");
      await page
        .getByRole("button", { name: "Hear the offer", exact: true })
        .click();
      if (!accepted) {
        await expect(modal).toContainText("You tryna come?");
        await snap(page, "05-npc-initiated-offer");
        await modal
          .getByRole("button", { name: "Tell me more about it.", exact: false })
          .click();
        await expect(modal).toContainText("No wages before we work");
        await modal.getByRole("button", { name: /^I'm in/ }).click();
        accepted = true;
        expect(
          (await state(page)).assignments.some(
            (a: any) => a.status === "accepted",
          ),
        ).toBe(true);
      } else {
        await modal.getByRole("button", { name: /^Can't make it/ }).click();
        declined = true;
      }
    }
    s = await state(page);
    const a = s.assignments.find(
      (a: any) => a.status === "accepted" && a.dueDay === s.day,
    );
    if (a) {
      await interact(page);
      await modal
        .getByRole("button", { name: /^Join scheduled activity/ })
        .click();
      completed = true;
    }
    s = await state(page);
    expired = s.crewOffers.some((o: any) => o.status === "expired");
    if (accepted && completed && declined && expired) break;
    await day(page);
  }
  const s = await state(page);
  expect({ accepted, completed, declined, expired }).toEqual({
    accepted: true,
    completed: true,
    declined: true,
    expired: true,
  });
  expect(s.characters.flacco.lastActionDay).toBeGreaterThan(10);
  expect(s.crewOffers.length).toBeLessThan(8);
});

for (const width of [320, 375, 390, 430])
  test(`crew dialogue and Set fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await start(page);
    await interact(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const bounds = await page.getByRole("dialog").boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.width).toBeLessThanOrEqual(width);
    await page
      .getByRole("button", { name: "Close conversation", exact: true })
      .click();
    await nav(page, "Set");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
