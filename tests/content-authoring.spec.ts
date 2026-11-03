import { copy } from "../src/content/copy";
import { test, expect } from "@playwright/test";
import { dismissEncounter, honest } from "./helpers";
for (const width of [320, 375, 390, 430]) {
  test(`authored dialogue and descriptions wrap at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./");
    await page
      .getByLabel(copy("interface.newRun.whatDoPeopleCallYou"))
      .fill("<b>Creator</b>");
    await page
      .getByRole("button", { name: copy("interface.newRun.enterStixxCity") })
      .click();
    const modal = page.getByRole("dialog", {
      name: copy("interface.app.characterEncounter"),
    });
    await expect(modal).toContainText(
      copy("storylines.the-chains.opening.dialogue", {
        amount: 150,
        details: "",
      }),
    );
    await modal
      .getByRole("button", {
        name: copy("storylines.the-chains.choices.clarify"),
      })
      .click();
    await expect(modal).toContainText(
      copy("storylines.the-chains.clarification.dialogue", { amount: 150 }),
    );
    await expect(modal.locator(".dialogue")).toBeVisible();
    const fits = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    await fits();
    for (const button of await modal.locator(".encounter-response").all()) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    }
    await dismissEncounter(page);
    await expect(page.locator(".scene-identity h1")).toHaveText(
      "<b>Creator</b>",
    );
    await expect(page.locator(".scene-identity h1 b")).toHaveCount(0);
    await honest(page);
    await expect(page.locator(".action-card").first()).toBeVisible();
    await fits();
    expect(errors).toEqual([]);
  });
}
