import { dismissEncounter } from "./helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { newGame } from "../src/core/Simulation";
import { player, type FactionId } from "../src/core/GameState";
import { performAction } from "../src/core/ActionEngine";
import { serialize, SAVE_KEY } from "../src/persistence/SaveSystem";

test("review captures and WCAG checks cover every M1 screen and faction palette", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  async function ready() {
    await page.evaluate(() => document.fonts.ready);
    for (const img of await page.locator("img").all()) {
      if (!(await img.isVisible())) continue;
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    await page.evaluate(() => scrollTo(0, 0));
  }
  async function audit() {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
  async function capture(name: string, fullPage = false) {
    await ready();
    await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage,
      scale: "css",
    });
    await info.attach(name, {
      path: info.outputPath(`${name}.png`),
      contentType: "image/png",
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(process.env.PLAYWRIGHT_BASE_PATH || "/");
  await capture("01-new-run-390", true);
  await audit();
  await page.getByLabel("What do people call you?").fill("Morgan");
  await page.getByRole("button", { name: "Enter Stixx City" }).click();
  await dismissEncounter(page);
  await capture("02-city-390");
  await audit();
  await page.setViewportSize({ width: 320, height: 700 });
  await capture("03-city-320");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const screen of ["People", "Actions", "Set", "Wallet"]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: screen, exact: true })
      .click();
    await ready();
    await audit();
    if (screen === "People") await capture("04-people-390", true);
    if (screen === "Actions") {
      for (const group of ["Honest", "Connects", "Streets"]) {
        await page.getByRole("button", { name: group, exact: true }).click();
        await audit();
      }
      await page.setViewportSize({ width: 430, height: 932 });
      await capture("05-actions-430", true);
    }
    if (screen === "Wallet") await capture("06-wallet-430", true);
  }
  // Eligible fixtures go through the real action engine; no shipped demo state or UI test hooks.
  for (const faction of [
    "angels",
    "blips",
    "muds",
    "backstreet",
    "blocks",
  ] as FactionId[]) {
    const s = newGame("Morgan", "nawf"),
      p = player(s);
    const sponsor = Object.values(s.characters).find(
      (c) => c.affiliation === faction && c.status === "active",
    )!;
    p.known = [...new Set([...p.known, sponsor.id])];
    p.connections = [...new Set([...p.connections, sponsor.id])];
    p.organizationStanding[faction] = 35;
    sponsor.relationships[p.id] = {
      trust: 35,
      respect: 10,
      affection: 0,
      grievance: 0,
      history: [],
    };
    const result = performAction(s, {
      type: "affiliate",
      actor: p.id,
      target: sponsor.id,
    });
    expect(result.error).toBeNull();
    await page.evaluate(
      ({ key, raw }) => {
        localStorage.clear();
        localStorage.setItem(key, raw);
      },
      { key: SAVE_KEY, raw: serialize(result.state) },
    );
    await page.reload();
    await page.getByRole("button", { name: "Resume saved game" }).click();
    await dismissEncounter(page);
    await ready();
    await audit();
    if (faction === "blips") {
      await page.setViewportSize({ width: 390, height: 844 });
      await capture("07-blips-390");
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture("08-city-desktop", true);
  await audit();
  expect(errors).toEqual([]);
});
