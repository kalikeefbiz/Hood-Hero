import { copy } from "../src/content/copy";
import { expect, type Page } from "@playwright/test";
// Baseline UI tests intentionally put aside the opening conversation first.
// Modal behavior itself is exercised in encounters.spec.ts.
export async function dismissEncounter(page: Page) {
  await expect(page.locator(".game-shell")).toBeVisible();
  const modal = page.getByRole("dialog", {
    name: copy("interface.app.characterEncounter"),
  });
  for (let i = 0; i < 8 && (await modal.count()); i++)
    await modal
      .getByRole("button", {
        name: copy("interface.encounterScene.closeConversation"),
      })
      .click();
}

export async function honest(page: Page) {
  await page
    .getByRole("navigation")
    .getByRole("button", {
      name: copy("interface.navigation.actions"),
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: copy("interface.navigation.honest"),
      exact: true,
    })
    .click();
}
export async function connects(page: Page, person?: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", {
      name: copy("interface.navigation.actions"),
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: copy("interface.navigation.connects"),
      exact: true,
    })
    .click();
  if (person)
    await page
      .getByLabel(copy("interface.actionsHub.connectedContacts"), {
        exact: true,
      })
      .selectOption(person);
}
export async function storyline(page: Page) {
  await dismissEncounter(page);
  await page
    .getByRole("navigation")
    .getByRole("button", {
      name: copy("interface.navigation.city"),
      exact: true,
    })
    .click();
  await dismissEncounter(page);
  await page
    .getByRole("button", { name: "Open The Chains storyline", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: copy("interface.app.characterEncounter"),
  });
  const clarify = modal.getByRole("button", {
    name: copy("storylines.the-chains.choices.clarify"),
  });
  if (await clarify.count()) await clarify.click();
}
export async function storyAction(page: Page, type: string) {
  await storyline(page);
  const names: Record<string, string | RegExp> = {
    buyback: copy("storylines.the-chains.choices.buyback"),
    negotiate: copy("storylines.the-chains.choices.negotiate"),
    settlement: copy("storylines.the-chains.choices.settlement"),
    recover: copy("storylines.the-chains.choices.recover"),
  };
  await page
    .getByRole("dialog", { name: copy("interface.app.characterEncounter") })
    .getByRole("button", { name: names[type] })
    .click();
}
