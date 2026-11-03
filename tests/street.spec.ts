import { connects, honest } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { dismissEncounter } from "./helpers";
import { newGame } from "../src/core/Simulation";
import { advanceDay } from "../src/core/TimeSystem";
import { performAction } from "../src/core/ActionEngine";
import {
  acquire,
  repay,
  saleLot,
  supplierError,
  transactionError,
} from "../src/systems/StreetEconomy";
import { requestActivity, cooperation } from "../src/systems/CrewAgency";
import { serialize } from "../src/persistence/SaveSystem";
import type { GameState } from "../src/core/GameState";
const key = "blackhouse.hoodhero-lab.v1.auto";
test.beforeEach(async ({ page }) => {
  if (process.env.PLAYWRIGHT_EXPECTED_COMMIT) {
    const r = await page.request.get(
      `${process.env.PLAYWRIGHT_BASE_PATH || "/"}build-info.json?verify=${Date.now()}`,
    );
    expect(r.ok()).toBe(true);
    const info = await r.json();
    expect(info.commit).toBe(process.env.PLAYWRIGHT_EXPECTED_COMMIT);
    expect(info.milestone).toBe("GOAL 007");
    expect(info.saveSchema).toBe(8);
  }
});
async function state(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state, key);
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function day(page: Page) {
  await dismissEncounter(page);
  await page.getByRole("button", { name: "End day" }).click();
  await dismissEncounter(page);
}
async function snap(page: Page, name: string) {
  const prefix = process.env.PLAYWRIGHT_PUBLIC_URL ? "live-" : "";
  const path = `docs/screenshots/goal-006-1/${prefix}${test.info().project.name}-${name}.png`;
  if (name.startsWith("03-") || name.startsWith("04-")) {
    await page.locator(".action-feedback").screenshot({ path, scale: "css" });
    return;
  }
  if (name.startsWith("08-")) {
    await page
      .locator(".panel")
      .filter({
        has: page.getByRole("heading", { name: "In custody", exact: true }),
      })
      .screenshot({ path, scale: "css" });
    return;
  }
  if (!name.startsWith("01-") && !name.startsWith("08-")) {
    await expect(page.locator(".action-feedback")).toHaveCount(0, {
      timeout: 7000,
    });
    await page
      .locator(
        name.startsWith("02-")
          ? ".inventory-panel"
          : name.startsWith("05-") || name === "07-default"
            ? ".obligations-panel"
            : name === "07-accumulated-attention"
              ? ".street-work"
              : ".transaction-history",
      )
      .screenshot({ path, scale: "css", animations: "disabled" });
    return;
  }
  await page.screenshot({ path, fullPage: false, scale: "css" });
}
async function resume(page: Page, s: GameState) {
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key,
    raw: serialize(s),
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await dismissEncounter(page);
}
function campaign(target: "custody" | "crew" | "default") {
  let s = newGame("Test(6) seeded journey", "south", 98713);
  const act = (type: "crime" | "gig" | "contact", target?: string) => {
    const r = performAction(s, { actor: "player", type, target });
    if (r.error) throw Error(r.error);
    s = r.state;
  };
  if (target === "default") {
    acquire(s, "mega", "consignment");
    for (let i = 0; i < 7; i++) s = advanceDay(s);
    return s;
  }
  for (let i = 0; i < 75; i++) {
    if (s.characters.player.status === "arrested") {
      if (target === "custody") return s;
      else {
        s = advanceDay(s);
        continue;
      }
    }
    if (s.end) throw Error("Seeded campaign ended");
    if (
      target === "crew" &&
      !cooperation(s, s.characters.flacco, "partner-crime").accepted
    ) {
      if (s.ap) act("contact", "flacco");
      s = advanceDay(s);
      continue;
    }
    const debt = s.street.agreements.find((a) => a.balance > 0);
    if (
      debt &&
      s.characters.player.wallet.clean + s.characters.player.wallet.illicit >=
        debt.balance
    )
      repay(s, debt.id, debt.balance);
    if (s.ap && !saleLot(s) && !supplierError(s, "mega", "consignment"))
      acquire(s, "mega", "consignment");
    while (s.ap && !transactionError(s)) {
      if (target === "crew") {
        requestActivity(s, "flacco", "partner-crime");
        if (s.street.transactions.at(-1)?.partner) return s;
        break;
      }
      act("crime");
    }
    if (s.ap) {
      const r = performAction(s, { actor: "player", type: "gig" });
      if (!r.error) s = r.state;
    }
    s = advanceDay(s);
  }
  throw Error(`No ${target} in bounded campaign`);
}
test("supplier to inventory to multiple real sales and repayment through normal mobile controls", async ({
  page,
}) => {
  test.setTimeout(test.info().project.name.includes("webkit") ? 180000 : 90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/assets/"))
      errors.push(`${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    if (r.url().includes("/assets/")) errors.push(`Asset failed: ${r.url()}`);
  });
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await page.getByLabel("What do people call you?").fill("Test(6)");
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await dismissEncounter(page);
  await nav(page, "Actions");
  await connects(page, "mega");
  await page.getByRole("button", { name: "Talk terms with Cuzzo" }).click();
  const modal = page.getByRole("dialog", { name: "Character encounter" });
  await expect(modal).toContainText("$102");
  await modal
    .getByRole("button", { name: "Explain the terms and risk." })
    .click();
  await expect(modal).toContainText("before supplier cost");
  await snap(page, "01-supplier-terms");
  await modal.getByRole("button", { name: /Accept consignment/ }).click();
  expect((await state(page)).street.lots[0].remaining).toBe(6);
  expect((await state(page)).characters.player.wallet.clean).toBe(125);
  await nav(page, "Wallet");
  await page
    .getByRole("heading", { name: "Inventory", exact: true })
    .scrollIntoViewIfNeeded();
  await page.locator(".inventory-slot summary").first().click();
  await snap(page, "02-inventory-and-obligation");
  let successes = 0,
    failures = 0;
  for (let i = 0; i < 8; i++) {
    let s = await state(page);
    if (!s.street.lots[0].remaining) break;
    if (!s.ap) await day(page);
    await nav(page, "Actions");
    const sell = page.getByRole("button", {
      name: "Pursue local transaction · 1 AP",
    });
    if (await sell.isDisabled()) {
      await day(page);
      continue;
    }
    await sell.click();
    s = await state(page);
    const t = s.street.transactions.at(-1);
    if (t.gross) {
      successes++;
      await snap(page, "03-successful-transaction");
    } else {
      failures++;
      await snap(page, "04-failed-transaction");
    }
  }
  expect(successes).toBeGreaterThan(0);
  expect((await state(page)).street.transactions.length).toBeGreaterThan(1);
  await nav(page, "Wallet");
  await page
    .getByRole("heading", { name: "Inventory", exact: true })
    .scrollIntoViewIfNeeded();
  await snap(page, "05-outstanding-balance");
  await page.getByRole("button", { name: "Discuss repayment" }).click();
  await modal.getByRole("button", { name: /Repay full balance/ }).click();
  await dismissEncounter(page);
  expect((await state(page)).street.agreements[0].balance).toBe(0);
  await nav(page, "Wallet");
  await page
    .getByRole("heading", { name: "Inventory", exact: true })
    .scrollIntoViewIfNeeded();
  await page.getByText("Supplier and lot records", { exact: true }).click();
  await snap(page, "06-repaid");
  const saved = await state(page);
  console.log(
    "JOURNEY",
    JSON.stringify({
      engine: test.info().project.name,
      day: saved.day,
      cash: saved.characters.player.wallet,
      lot: saved.street.lots[0],
      transactions: saved.street.transactions,
      agreement: saved.street.agreements[0],
    }),
  );
  await page.getByLabel("Save game", { exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume saved game" }).click();
  await dismissEncounter(page);
  expect((await state(page)).street).toEqual(saved.street);
  expect(errors).toEqual([]);
});
test("seeded real-play arrest serves every day and releases into continued gameplay", async ({
  page,
}) => {
  const s = campaign("custody");
  await resume(page, s);
  await expect(
    page.getByRole("heading", { name: "In custody", exact: true }),
  ).toBeVisible();
  await snap(page, "08-arrest-and-incarceration");
  const before = await state(page);
  await page.getByRole("button", { name: "Serve remaining sentence" }).click();
  await dismissEncounter(page);
  const after = await state(page);
  console.log(
    "CUSTODY",
    JSON.stringify({
      engine: test.info().project.name,
      arrestDay: before.day,
      releaseDay: after.day,
      cashBefore:
        before.characters.player.wallet.clean +
        before.characters.player.wallet.illicit,
      cashAfter:
        after.characters.player.wallet.clean +
        after.characters.player.wallet.illicit,
      debtAfter: after.street.agreements.reduce(
        (n: number, a: { balance: number }) => n + a.balance,
        0,
      ),
      loco: after.characters.loco.status,
      campaignEnd: after.end,
    }),
  );
  expect(after.characters.player.status).toBe("active");
  expect(after.day).toBeGreaterThan(before.day);
  expect(after.characters.loco.status).toBe("arrested");
  expect(after.end).toBeNull();
  expect(after.street.custody.at(-1).status).toBe("released");
  await nav(page, "Actions");
  await honest(page);
  await page.locator('[data-action="gig"]').getByRole("button").click();
  expect((await state(page)).ap).toBe(1);
  await nav(page, "Wallet");
  await page.getByText("Custody history", { exact: true }).click();
  await expect(page.locator(".transaction-history")).toContainText(
    "Custody record · released",
  );
  await snap(page, "09-release");
  await nav(page, "Actions");
  await expect(
    page.getByRole("button", { name: "Pursue local transaction · 1 AP" }),
  ).toBeVisible();
});
test("default reaction and accumulated heat are rendered from real simulated consequences", async ({
  page,
}) => {
  const s = campaign("default");
  await resume(page, s);
  await nav(page, "Wallet");
  await page
    .getByRole("heading", { name: "Inventory", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".obligations-panel")).toContainText("overdue");
  await snap(page, "07-default");
  const hot = campaign("custody");
  await resume(page, hot);
  await nav(page, "Wallet");
  await page
    .getByRole("heading", { name: "Inventory", exact: true })
    .scrollIntoViewIfNeeded();
  await nav(page, "Actions");
  await snap(page, "07-accumulated-attention");
});
test("crew-assisted street work uses an earned willing partner and actual inventory", async ({
  page,
}) => {
  const s = campaign("crew");
  await resume(page, s);
  await nav(page, "Wallet");

  await page
    .getByText(/with Flacco/)
    .last()
    .scrollIntoViewIfNeeded();
  await snap(page, "10-crew-assisted");
  expect((await state(page)).street.transactions.at(-1).partner).toBe("flacco");
  await nav(page, "Set");
  await expect(page.locator("main")).toContainText("Shared street transaction");
});
for (const width of [320, 375, 390, 430])
  test(`street inventory and supplier modal fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const s = newGame("Mobile", "south");
    await resume(page, s);
    await nav(page, "Actions");
    await connects(page, "mega");
    await page.getByRole("button", { name: "Talk terms with Cuzzo" }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(
      page.getByRole("button", { name: /Accept consignment/ }),
    ).toBeVisible();
  });
