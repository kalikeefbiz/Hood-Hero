import type { Page } from "@playwright/test";
/** History, promises, position and activity live in the Journal ledger. */
export async function openJournal(page: Page) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Journal", exact: true })
    .click();
}
