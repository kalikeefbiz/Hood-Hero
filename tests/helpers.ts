import { expect, type Page } from "@playwright/test";
// Baseline UI tests intentionally put aside the opening conversation first.
// Modal behavior itself is exercised in encounters.spec.ts.
export async function dismissEncounter(page: Page) {
  await expect(page.locator(".game-shell")).toBeVisible();
  const modal = page.getByRole("dialog", { name: "Character encounter" });
  for (let i = 0; i < 8 && (await modal.count()); i++)
    await modal.getByRole("button", { name: "Close conversation" }).click();
}
