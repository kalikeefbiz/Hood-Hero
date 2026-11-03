import { copy } from "../src/content/copy";
import { honest, connects, storyAction, storyline } from "./helpers";
import { dismissEncounter } from "./helpers";
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
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await page
    .getByLabel(copy("interface.newRun.whatDoPeopleCallYou"))
    .fill("Morgan");
  await page.getByRole("radio", { name: home, exact: false }).check();
  await page
    .getByRole("button", { name: copy("interface.newRun.enterStixxCity") })
    .click();
  await dismissEncounter(page);
  await expect(page.getByRole("heading", { name: "Morgan" })).toBeVisible();
}
async function action(page: import("@playwright/test").Page, title: string) {
  if (title.includes("Buy back")) {
    await storyAction(page, "buyback");
    return;
  }
  if (title === "Reach out") await connects(page, "mega");
  else await honest(page);
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
  await nav(page, copy("interface.navigation.actions"));
  await nav(page, copy("interface.navigation.actions"));

  await action(page, copy("actions.reachOut.label"));
  await expect(page.getByRole("status")).toContainText("Trust grew");
  await nav(page, copy("interface.navigation.actions"));
  await page
    .getByRole("button", {
      name: copy("interface.navigation.honest"),
      exact: true,
    })
    .click();
  await action(page, copy("actions.buttons.gig"));
  await expect(page.locator(".ap b")).toHaveText("0/2");
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await expect(page.locator(".day")).toHaveText("DAY 02");
  await page
    .getByLabel(copy("interface.gameHUD.saveGame"), { exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved day 2");
  await action(page, copy("actions.buttons.gig"));
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await expect(page.locator(".day")).toHaveText("DAY 03");
  await page
    .getByLabel(copy("interface.gameHUD.loadGame"), { exact: true })
    .click();
  await expect(page.locator(".day")).toHaveText("DAY 02");
  await expect(page.locator(".ap b")).toHaveText("2/2");
  await page.reload();
  await page
    .getByRole("button", { name: copy("interface.newRun.resumeSavedGame") })
    .click();
  await dismissEncounter(page);
  await expect(page.locator(".day")).toHaveText("DAY 02");
  for (const name of ["City", "People", "Actions", "Set", "Wallet"]) {
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
  await nav(page, copy("interface.navigation.actions"));
  await action(page, copy("actions.buttons.gig"));
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await action(page, copy("actions.buttons.gig"));
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await nav(page, copy("interface.navigation.actions"));

  await action(page, copy("actions.reachOut.label"));
  await action(page, "Buy back · $150");
  await dismissEncounter(page);
  await nav(page, copy("interface.navigation.city"));
  await page
    .getByText(copy("interface.app.completedStorylines"), { exact: true })
    .click();
  await expect(page.locator(".situation-history")).toContainText("resolved");
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await nav(page, copy("interface.navigation.actions"));
  await page
    .getByRole("button", {
      name: copy("interface.navigation.honest"),
      exact: true,
    })
    .click();
  await action(page, copy("actions.buttons.gig"));
  await expect(page.getByRole("status")).toContainText("$38");
  await nav(page, copy("interface.navigation.set"));
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await nav(page, copy("interface.navigation.set"));
  await page
    .getByRole("button", { name: "Interact with Flacco", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: copy("crew-dialogue.activities.paidLocalWork"),
    })
    .click();
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
  await nav(page, copy("interface.navigation.set"));
  await expect(page.locator("main")).toContainText(
    copy("crew-dialogue.activities.paidLocalWork"),
  );
  await nav(page, copy("interface.navigation.wallet"));
  await expect(page.locator("main")).toContainText("Reserved compensation");
  await noOverflow(page);
});
test("mobile city and new game remain readable at narrow widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await noOverflow(page);
  await page
    .getByLabel(copy("interface.newRun.whatDoPeopleCallYou"))
    .fill("A long player name for testing");
  await page
    .getByRole("button", { name: copy("interface.newRun.enterStixxCity") })
    .click();
  await dismissEncounter(page);
  await noOverflow(page);
  await page.getByRole("button", { name: "Select The Nawf" }).click();
  await expect(page.locator(".zone-details")).toContainText("The Blips");
  await expect(page.locator(".zone-details")).toContainText("Mudgang");
  await page.screenshot({
    path: `test-results/${test.info().project.name}-city.png`,
    fullPage: true,
  });
});
