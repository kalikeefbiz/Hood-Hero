import { copy } from "../src/content/copy";
import { test, expect, type Page } from "@playwright/test";
import {
  dismissEncounter,
  connects,
  honest,
  storyline,
  storyAction,
} from "./helpers";
const key = "blackhouse.syndicate.v1.auto";
const state = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state, key);
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function start(page: Page, home = "Southside") {
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await page
    .getByLabel(copy("interface.newRun.whatDoPeopleCallYou"))
    .fill("Test(6.1)");
  await page.getByRole("radio", { name: home, exact: false }).check();
  await page
    .getByRole("button", { name: copy("interface.newRun.enterStixxCity") })
    .click();
  await dismissEncounter(page);
}
async function clickAction(page: Page, type: string) {
  await page.locator(`[data-action="${type}"]`).getByRole("button").click();
}
async function day(page: Page) {
  await dismissEncounter(page);
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
}
async function shot(page: Page, selector: string, name: string) {
  await expect(page.locator(".action-feedback")).toHaveCount(0, {
    timeout: 7000,
  });
  await page.locator(selector).screenshot({
    path: `docs/screenshots/goal-006-1/${process.env.PLAYWRIGHT_PUBLIC_URL ? "live-" : ""}${test.info().project.name}-${name}.png`,
    scale: "css",
    animations: "disabled",
  });
}
test.beforeEach(async ({ page }) => {
  if (process.env.PLAYWRIGHT_EXPECTED_COMMIT) {
    const r = await page.request.get(
      `${process.env.PLAYWRIGHT_BASE_PATH || "/"}build-info.json?v=${Date.now()}`,
    );
    const b = await r.json();
    expect(b.commit).toBe(process.env.PLAYWRIGHT_EXPECTED_COMMIT);
    expect(b.milestone).toBe("GOAL 007");
    expect(b.saveSchema).toBe(8);
  }
});
test("Actions separate Streets, Honest and Connects; completed reach-out returns to Streets", async ({
  page,
}) => {
  test.setTimeout(90000);
  await start(page);
  await nav(page, copy("interface.navigation.actions"));
  await expect(
    page.getByRole("button", {
      name: copy("interface.navigation.streets"),
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-action="apply"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Talk terms with Cuzzo" }),
  ).toHaveCount(0);
  await shot(page, ".actions-hub", "01-streets");
  await honest(page);
  await expect(page.locator('[data-action="apply"]').first()).toBeVisible();
  await expect(page.locator('[data-action="gig"]')).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: copy("interface.streetWork.pursueLocalTransaction1AP"),
    }),
  ).toHaveCount(0);
  await shot(page, ".actions-hub", "02-honest");
  await connects(page, "mega");
  await expect(
    page.getByRole("button", { name: "Talk terms with Cuzzo" }),
  ).toBeVisible();
  expect(
    (await page.locator(".connect-action").first().boundingBox())!.height,
  ).toBeLessThan(100);
  await shot(page, ".actions-hub", "03-connects");
  await clickAction(page, "contact");
  await expect(
    page.getByRole("button", {
      name: copy("interface.navigation.streets"),
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await state(page)).ap).toBe(1);
  await expect(page.locator(".action-feedback")).toContainText("Trust grew");
  await connects(page, "mega");
  await clickAction(page, "contact");
  await connects(page, "mega");
  await expect(page.locator(".supplier-entry .disabled-reason")).toHaveCount(1);
  await page.getByRole("button", { name: "Talk terms with Cuzzo" }).click();
  const modal = page.getByRole("dialog", {
    name: copy("interface.app.characterEncounter"),
  });
  await expect(modal.locator(".disabled-reason")).toHaveCount(1);
  await expect(
    modal.getByRole("button", { name: /Accept consignment/ }),
  ).toBeDisabled();
  await modal
    .getByRole("button", { name: copy("supplier-dialogue.choices.decline") })
    .click();
  await expect(
    page.getByRole("button", {
      name: copy("interface.navigation.streets"),
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("known suspects and leaders need real introductions; access and inventory survive reload", async ({
  page,
}) => {
  test.setTimeout(90000);
  await start(page, "Rio Gabriel");
  await nav(page, copy("interface.navigation.people"));
  await page
    .locator(".person-row")
    .filter({ has: page.getByText("Pablo", { exact: true }) })
    .click();
  await expect(
    page.getByRole("button", { name: "Interact with Pablo →" }),
  ).toBeDisabled();
  await connects(page, "resident-rio");
  await page
    .getByText(copy("interface.actionsHub.knownOfIntroductionsNeeded"), {
      exact: true,
    })
    .click();
  await expect(page.locator(".known-contacts")).toContainText("Pablo");
  await shot(page, ".actions-hub", "04-contact-access");
  await clickAction(page, "introduce");
  let s = await state(page);
  expect(s.characters.player.connections).toContain("dizzy");
  expect(s.characters.player.connections).not.toContain("pablo");
  await connects(page, "dizzy");
  await clickAction(page, "contact");
  await day(page);
  await connects(page, "dizzy");
  await clickAction(page, "contact");
  await connects(page, "dizzy");
  await clickAction(page, "introduce");
  expect((await state(page)).characters.player.connections).toContain("pablo");
  await day(page);
  await connects(page, "dizzy");
  await page.getByRole("button", { name: "Talk terms with Dizzy" }).click();
  await shot(page, ".encounter-scene", "05-supplier-terms");
  await page
    .getByRole("dialog", { name: copy("interface.app.characterEncounter") })
    .getByRole("button", { name: /Accept consignment/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: copy("interface.navigation.streets"),
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await nav(page, copy("interface.navigation.wallet"));
  await expect(page.locator(".inventory-slot")).toContainText("×6");
  await page.locator(".inventory-slot summary").click();
  await expect(page.locator(".inventory-panel .lot-details")).toContainText(
    "debt $102",
  );
  await shot(page, ".inventory-panel", "06-inventory");
  const saved = await state(page);
  await page.reload();
  await page
    .getByRole("button", { name: copy("interface.newRun.resumeSavedGame") })
    .click();
  await dismissEncounter(page);
  expect((await state(page)).characters.player.connections).toEqual(
    saved.characters.player.connections,
  );
  expect((await state(page)).street).toEqual(saved.street);
});
test("active Chains lives in City; fulfillment leaves only completed history", async ({
  page,
}) => {
  test.setTimeout(90000);
  await start(page);
  await storyline(page);
  const modal = page.getByRole("dialog", {
    name: copy("interface.app.characterEncounter"),
  });
  await modal
    .getByRole("button", {
      name: copy("storylines.the-chains.choices.promise"),
    })
    .click();
  await honest(page);
  await clickAction(page, "gig");
  await storyAction(page, "buyback");
  await dismissEncounter(page);
  await nav(page, copy("interface.navigation.city"));
  await expect(
    page.getByRole("region", {
      name: copy("interface.app.storylines"),
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByText(copy("interface.app.completedStorylines"), { exact: true })
    .click();
  await expect(page.locator(".situation-history")).toContainText("fulfilled");
  await shot(page, ".situation-history", "07-storyline-history");
  await nav(page, copy("interface.navigation.actions"));
  await expect(page.locator(".commitment-summary")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "The Chains", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('[data-action="buyback"]')).toHaveCount(0);
});
for (const width of [320, 375, 390, 430])
  test(`all three categories and inventory fit ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 844 });
    await start(page);
    await nav(page, copy("interface.navigation.actions"));
    for (const group of ["Streets", "Honest", "Connects"]) {
      await page.getByRole("button", { name: group, exact: true }).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.getByRole("button", { name: "Talk terms with Cuzzo" }).click();
    await page
      .getByRole("dialog", { name: copy("interface.app.characterEncounter") })
      .getByRole("button", { name: /Accept consignment/ })
      .click();
    await nav(page, copy("interface.navigation.wallet"));
    await page.locator(".inventory-slot summary").click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
