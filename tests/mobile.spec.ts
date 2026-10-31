import { test, expect } from "@playwright/test";
async function nav(page: import("@playwright/test").Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function start(
  page: import("@playwright/test").Page,
  home = "Southside",
) {
  await page.goto("/");
  await page.getByLabel("What do people call you?").fill("Morgan");
  await page.getByRole("radio", { name: home, exact: false }).check();
  await page.getByRole("button", { name: "Enter The Stixx" }).click();
  await expect(page.getByRole("heading", { name: "Morgan" })).toBeVisible();
}
async function action(page: import("@playwright/test").Page, title: string) {
  await page
    .locator(".action-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button")
    .click();
}
async function noOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("phone gameplay: contact, lawful income, days, save and load", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, "Downtown");
  await noOverflow(page);
  await nav(page, "Actions");
  await page.getByRole("button", { name: "The Chains", exact: true }).click();
  await action(page, "Reach out");
  await expect(page.getByRole("status")).toContainText("Trust grew");
  await page.getByRole("button", { name: "Everyday", exact: true }).click();
  await action(page, "Take a local gig");
  await expect(page.locator(".ap b")).toHaveText("0/2");
  await page.getByRole("button", { name: "End day" }).click();
  await expect(page.locator(".day")).toHaveText("DAY 02");
  await page.getByLabel("Save game", { exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved day 2");
  await action(page, "Work a full shift");
  await page.getByRole("button", { name: "End day" }).click();
  await expect(page.locator(".day")).toHaveText("DAY 03");
  await page.getByLabel("Load game", { exact: true }).click();
  await expect(page.locator(".day")).toHaveText("DAY 02");
  await expect(page.locator(".ap b")).toHaveText("2/2");
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await expect(page.locator(".day")).toHaveText("DAY 02");
  for (const name of [
    "City",
    "People",
    "Actions",
    "Set",
    "Wallet",
    "Activity",
  ]) {
    await nav(page, name);
    await noOverflow(page);
  }
  await page.screenshot({
    path: `test-results/${test.info().project.name}-activity.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("buyback resolves the incident and the ordinary loop remains playable", async ({
  page,
}) => {
  await start(page);
  await nav(page, "Actions");
  await action(page, "Work a full shift");
  await page.getByRole("button", { name: "End day" }).click();
  await page.getByRole("button", { name: "The Chains", exact: true }).click();
  await action(page, "Reach out");
  await action(page, "Buy back · $150");
  await expect(page.locator(".situation .status-chip")).toHaveText("resolved");
  await page.getByRole("button", { name: "End day" }).click();
  await page.getByRole("button", { name: "Everyday", exact: true }).click();
  await action(page, "Work a full shift");
  await expect(page.getByRole("status")).toContainText("$96");
  await nav(page, "Set");
  await page.getByRole("button", { name: "End day" }).click();
  await page
    .getByRole("button", { name: "Assign a paid errand", exact: false })
    .click();
  await page.getByRole("button", { name: "End day" }).click();
  await expect(page.locator("main")).toContainText("completed");
  await nav(page, "Wallet");
  await expect(page.locator("main")).toContainText("Errand by Flacco");
  await noOverflow(page);
});
test("mobile city and new game remain readable at narrow widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await noOverflow(page);
  await page
    .getByLabel("What do people call you?")
    .fill("A long player name for testing");
  await page.getByRole("button", { name: "Enter The Stixx" }).click();
  await noOverflow(page);
  await page.getByRole("button", { name: "Select The Nawf" }).click();
  await expect(page.locator(".zone-details")).toContainText("The Blips");
  await expect(page.locator(".zone-details")).toContainText("Mudgang");
  await page.screenshot({
    path: `test-results/${test.info().project.name}-city.png`,
    fullPage: true,
  });
});
