import { expect, type Page } from "@playwright/test";
// Baseline UI tests intentionally put aside the opening conversation first.
// Modal behavior itself is exercised in encounters.spec.ts.
export async function dismissEncounter(page: Page) {
  await expect(page.locator(".game-shell")).toBeVisible();
  const modal = page.getByRole("dialog", { name: "Character encounter" });
  if (await modal.count())
    await modal.getByRole("button", { name: "Close conversation" }).click();
}
