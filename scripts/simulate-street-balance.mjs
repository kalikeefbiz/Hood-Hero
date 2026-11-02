import { createServer } from "vite";
import { writeFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
const v = await createServer({ server: { middlewareMode: true } });
const { newGame } = await v.ssrLoadModule("/src/core/Simulation.ts");
const { advanceDay } = await v.ssrLoadModule("/src/core/TimeSystem.ts");
const { performAction } = await v.ssrLoadModule("/src/core/ActionEngine.ts");
const { acquire, repay, saleLot, supplierError, transactionError, lotProfit } =
  await v.ssrLoadModule("/src/systems/StreetEconomy.ts");
const { BALANCE } = await v.ssrLoadModule("/src/content/balance.ts");
const { serialize, deserialize } = await v.ssrLoadModule(
  "/src/persistence/SaveSystem.ts",
);
function run(seed, strategy, reload) {
  let s = newGame("Test(6.1)", "south", seed),
    maxHeat = 0,
    maxEarlyHeat = 0,
    streetAP = 0,
    gigAP = 0,
    restAP = 0,
    arrestedDays = 0,
    heatTotal = 0;
  const act = (type) => {
    const r = performAction(s, { type, actor: "player" });
    if (r.error) throw Error(r.error);
    s = r.state;
  };
  while (s.day <= 30 && !s.end) {
    const p = s.characters.player;
    if (p.status === "arrested") arrestedDays++;
    let guard = 0;
    while (s.ap && s.characters.player.status === "active" && guard++ < 4) {
      const p = s.characters.player;
      const debt = s.street.agreements.find((a) => a.balance > 0);
      if (debt && p.wallet.clean + p.wallet.illicit >= debt.balance + 18)
        repay(s, debt.id, debt.balance);
      const streetDay =
        strategy === "aggressive" ||
        (strategy === "occasional" ? s.day % 3 === 0 : s.day % 4 !== 0);
      if (streetDay && !transactionError(s)) {
        act("crime");
        streetAP++;
      } else if (
        streetDay &&
        !saleLot(s) &&
        !supplierError(s, "mega", "consignment")
      ) {
        acquire(s, "mega", "consignment");
        streetAP++;
      } else if (!performAction(s, { type: "gig", actor: "player" }).error) {
        act("gig");
        gigAP++;
      } else {
        act("rest");
        restAP++;
      }
      maxHeat = Math.max(maxHeat, s.characters.player.police);
      if (s.day <= 7)
        maxEarlyHeat = Math.max(maxEarlyHeat, s.characters.player.police);
    }
    heatTotal += s.characters.player.police;
    s = advanceDay(s);
    if (reload) s = deserialize(serialize(s));
  }
  const p = s.characters.player;
  return {
    state: JSON.parse(serialize(s)),
    result: {
      schema: s.version,
      seed,
      strategy,
      days: s.day - 1,
      end: s.end,
      cash: p.wallet.clean + p.wallet.illicit,
      profit: s.street.lots.reduce((n, l) => n + lotProfit(l), 0),
      debt: s.street.agreements.reduce((n, a) => n + a.balance, 0),
      repaid: s.street.agreements.reduce((n, a) => n + a.repaid, 0),
      defaults: s.commitments.filter(
        (c) => c.kind === "supplier-debt" && c.status === "broken",
      ).length,
      arrears: s.street.arrears,
      lots: s.street.lots.length,
      transactions: s.street.transactions.length,
      lost: s.street.lots.reduce((n, l) => n + l.lost, 0),
      maxHeat,
      maxEarlyHeat,
      meanHeat: heatTotal / 30,
      arrests: s.street.custody.filter((r) => r.character === "player").length,
      arrestedDays,
      streetAP,
      gigAP,
      restAP,
      streetOpportunityCost: streetAP * BALANCE.gigIncome,
      profitAfterAPBenchmark:
        s.street.lots.reduce((n, l) => n + lotProfit(l), 0) -
        streetAP * BALANCE.gigIncome,
      liquidNetChange:
        p.wallet.clean +
        p.wallet.illicit -
        s.street.agreements.reduce((n, a) => n + a.balance, 0) -
        s.street.arrears -
        BALANCE.startingCash,
      deterministic: true,
    },
  };
}
const results = [];
for (const strategy of ["occasional", "frequent", "aggressive"])
  for (const seed of [1, 7, 21, 83, 2026, 5099, 98713, 333333]) {
    const a = run(seed, strategy, true),
      b = run(seed, strategy, false);
    deepStrictEqual(a.state, b.state);
    results.push(a.result);
  }
const path = process.argv[2] || "docs/validation/GOAL_006_1_BALANCE_AFTER.json";
writeFileSync(path, JSON.stringify(results, null, 2) + "\n");
console.log(path, results.length, "campaigns");
await v.close();
