import { deepStrictEqual } from "node:assert";
import { createServer } from "vite";
import { writeFileSync } from "node:fs";
const v = await createServer({ server: { middlewareMode: true } });
const { newGame } = await v.ssrLoadModule("/src/core/Simulation.ts");
const { advanceDay } = await v.ssrLoadModule("/src/core/TimeSystem.ts");
const { performAction } = await v.ssrLoadModule("/src/core/ActionEngine.ts");
const { acquire, repay, saleLot, supplierError, transactionError, lotProfit } =
  await v.ssrLoadModule("/src/systems/StreetEconomy.ts");
const { requestActivity, cooperation } = await v.ssrLoadModule(
  "/src/systems/CrewAgency.ts",
);
const { serialize, deserialize } = await v.ssrLoadModule(
  "/src/persistence/SaveSystem.ts",
);
const results = [];
function run(seed, strategy, home, checkpoint) {
  let s = newGame("Test(6)", home, seed);
  const act = (type, target, jobId) => {
    const r = performAction(s, { actor: s.playerId, type, target, jobId });
    if (r.error) throw new Error(r.error);
    s = r.state;
  };
  let days = 0;
  while (days < 60 && !s.end) {
    let safety = 0;
    while (s.ap && s.characters.player.status === "active" && safety++ < 6) {
      const p = s.characters.player;
      const debt = s.street.agreements.find((a) => a.balance > 0);
      if (debt && p.wallet.clean + p.wallet.illicit >= debt.balance + 18)
        repay(s, debt.id, debt.balance);
      const crime =
        strategy !== "lawful" &&
        (strategy === "criminal" ||
          strategy === "crew" ||
          (strategy === "occasional"
            ? s.day % 6 === 0 &&
              !s.street.transactions.some(
                (t) => t.actor === s.playerId && t.day === s.day,
              )
            : s.day % 3 === 0));
      if (crime && !transactionError(s)) {
        if (
          strategy === "crew" &&
          cooperation(s, s.characters.flacco, "partner-crime").accepted
        )
          requestActivity(s, "flacco", "partner-crime");
        else act("crime");
      } else if (
        crime &&
        !saleLot(s) &&
        !supplierError(
          s,
          "mega",
          strategy === "occasional" ? "cash" : "consignment",
        )
      )
        acquire(s, "mega", strategy === "occasional" ? "cash" : "consignment");
      else if (
        strategy === "lawful" &&
        !s.employment.some(
          (e) => e.actor === "player" && e.status === "employed",
        )
      ) {
        const { JOBS } = jobsModule;
        const j = JOBS.find((j) => j.location === home) ?? JOBS[0];
        const r = performAction(s, {
          actor: "player",
          type: "apply",
          jobId: j.id,
        });
        if (r.error) {
          act("gig");
        } else {
          s = r.state;
          act("acceptJob", undefined, j.id);
        }
      } else {
        const shift = performAction(s, { actor: "player", type: "work" });
        if (!shift.error) s = shift.state;
        else {
          const gig = performAction(s, { actor: "player", type: "gig" });
          if (!gig.error) s = gig.state;
          else act("contact", strategy === "crew" ? "flacco" : "mega");
        }
      }
    }
    s = advanceDay(s);
    days++;
    if (checkpoint) s = deserialize(serialize(s));
    if (s.characters.loco.status !== "arrested")
      throw new Error("Loco released");
    for (const l of s.street.lots)
      if (l.remaining < 0 || l.owed < 0) throw new Error("negative lot");
    if (
      s.characters.player.wallet.clean < 0 ||
      s.characters.player.wallet.illicit < 0
    )
      throw new Error("negative cash");
  }
  return { s, days };
}
const jobsModule = await v.ssrLoadModule("/src/content/jobs.ts");
for (const strategy of ["lawful", "occasional", "mixed", "criminal", "crew"])
  for (const [i, seed] of [1, 7, 21, 83, 2026].entries()) {
    const home = ["downtown", "rio", "south", "resevoir", "nawf"][i];
    const { s, days } = run(seed, strategy, home, true);
    const replay = run(seed, strategy, home, false).s;
    deepStrictEqual(
      JSON.parse(serialize(s)),
      JSON.parse(serialize(replay)),
      `checkpoint divergence ${seed} ${strategy}`,
    );
    const p = s.characters.player;
    results.push({
      seed,
      strategy,
      home,
      days,
      end: s.end,
      cash: p.wallet.clean + p.wallet.illicit,
      clean: p.wallet.clean,
      illicit: p.wallet.illicit,
      arrears: s.street.arrears,
      debt: s.street.agreements.reduce((n, a) => n + a.balance, 0),
      lots: s.street.lots.length,
      transactions: s.street.transactions.length,
      goodsLost: s.street.lots.reduce((n, l) => n + l.lost, 0),
      profit: s.street.lots.reduce((n, l) => n + lotProfit(l), 0),
      police: p.police,
      arrests: s.street.custody.filter((r) => r.character === "player").length,
      crewTransactions: s.street.transactions.filter((t) => t.partner).length,
      crewStatus: s.characters.flacco.status,
      marketActivity: Object.values(s.street.markets).reduce(
        (n, m) => n + m.activity,
        0,
      ),
      encounters: s.encounters.length,
      events: s.events.length,
      deterministic: true,
    });
  }
writeFileSync(
  "docs/validation/GOAL_006_CAMPAIGNS.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
await v.close();
