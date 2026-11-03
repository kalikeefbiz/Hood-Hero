import { createServer } from "vite";
import { writeFileSync, readFileSync } from "node:fs";
import { deepStrictEqual, ok } from "node:assert";
import { performance } from "node:perf_hooks";
const v = await createServer({ server: { middlewareMode: true } });
const load = (p) => v.ssrLoadModule("/src/" + p);
const { newGame } = await load("core/Simulation.ts"),
  { advanceDay } = await load("core/TimeSystem.ts"),
  { performAction, validateAction } = await load("core/ActionEngine.ts");
const { serialize, deserialize } = await load("persistence/SaveSystem.ts");
const { businessAction, businessError } = await load("systems/Businesses.ts");
const {
  politicalAction,
  politicalError,
  promote,
  promotionRequirements,
  representative,
} = await load("systems/Politics.ts");
const { currentEmployment, shiftToday, jobOpportunities } = await load(
  "systems/Employment.ts",
);
const { acquire, suppliers, supplierError, transactionError, repay } =
  await load("systems/StreetEconomy.ts");
const { arrest } = await load("systems/Incarceration.ts");
const { payArrears } = await load("systems/Economy.ts");
const { applyInfluence } = await load("systems/Territory.ts");
let results = process.env.CAMPAIGN_RESUME
  ? JSON.parse(readFileSync("docs/validation/GOAL_007_CAMPAIGNS.json", "utf8"))
      .results
  : [];
function campaign(seed, mode, reload) {
  let s = newGame("Test(7) " + mode, "south", seed),
    actions = {},
    times = [],
    changes = [];
  const act = (type, target, jobId) => {
    const r = performAction(s, { actor: "player", type, target, jobId });
    if (!r.error) {
      s = r.state;
      actions[type] = (actions[type] ?? 0) + 1;
      return true;
    }
    return false;
  };
  for (let day = 0; day < 180; day++) {
    const start = performance.now();
    if (mode === "custody" && day === 70)
      arrest(s, "player", "Controlled incarceration scenario", 2);
    if (mode === "changing-control" && s.day >= 60 && s.day < 85) {
      for (const kind of ["reputation-loss", "disruption"])
        applyInfluence(s, {
          actor: "angels",
          faction: "angels",
          zone: "rio",
          kind,
          magnitude: 15,
          cause: "Controlled sustained political and economic disruption",
        });
    }
    for (
      let tries = 0;
      tries < 4 && s.ap && s.characters.player.status === "active" && !s.end;
      tries++
    ) {
      const p = s.characters.player;
      const debt = s.street.agreements.find((a) => a.balance > 0);
      if (debt && p.wallet.clean + p.wallet.illicit > debt.balance + 100)
        repay(s, debt.id, debt.balance);
      if (s.street.arrears && p.wallet.clean > s.street.arrears + 100)
        s = payArrears(s).state;
      if (mode === "passive") {
        act("rest");
        continue;
      }
      if (mode === "political" && !p.affiliation) {
        if (
          !validateAction(s, {
            actor: "player",
            type: "affiliate",
            target: "mega",
          })
        ) {
          act("affiliate", "mega");
          continue;
        }
        act(
          p.organizationStanding.backstreet < 35 ? "standing" : "contact",
          "mega",
        );
        continue;
      }
      if (mode === "political" && p.affiliation && shiftToday(s) && s.ap >= 2) {
        act("work");
        continue;
      }
      if (mode === "political" && p.affiliation) {
        if (!promotionRequirements(s).missing.length && s.ap) {
          const r = promote(s);
          if (!r.error) {
            s = r.state;
            actions.promote = (actions.promote ?? 0) + 1;
            continue;
          }
        }
        if (!p.connections.includes("justice")) {
          if (act("introduce", "mega")) continue;
        }
        if (
          p.connections.includes("justice") &&
          (s.characters.justice.relationships.player?.trust ?? 0) < 65 &&
          s.day % 3 === 0
        ) {
          if (act("contact", "justice")) continue;
        }
        const rep = representative(s, "south");
        const type = p.authority >= 25 ? "operation" : "support";
        if (!politicalError(s, type, "south", rep)) {
          s = politicalAction(s, type, "south", rep).state;
          actions[type] = (actions[type] ?? 0) + 1;
          continue;
        }
      }
      if (mode === "mixed" && s.day % 4 === 0) {
        if (!transactionError(s)) {
          act("crime");
          continue;
        }
        const supplier = suppliers(s).find(
          (n) => !supplierError(s, n.id, "consignment"),
        );
        if (supplier) {
          acquire(s, supplier.id, "consignment");
          actions.acquire = (actions.acquire ?? 0) + 1;
          continue;
        }
      }
      if (["business", "custody"].includes(mode)) {
        const owned = s.strategic.businesses.find(
          (b) => !["closed", "sold"].includes(b.status),
        );
        if (
          owned &&
          owned.condition < 55 &&
          !businessError(s, owned.definition, "maintain")
        ) {
          s = businessAction(s, owned.definition, "maintain").state;
          actions.maintain = (actions.maintain ?? 0) + 1;
          continue;
        }
        if (
          !s.strategic.businesses.length &&
          !businessError(s, "repair", "buy") &&
          p.wallet.clean > 2000
        ) {
          s = businessAction(s, "repair", "buy").state;
          actions.business = 1;
          continue;
        }
      }
      if (!currentEmployment(s)) {
        const offered = s.employmentSearch.player.offeredJob;
        if (offered && act("acceptJob", undefined, offered)) continue;
        const j = jobOpportunities(s).find(
          (j) =>
            !validateAction(s, { actor: "player", type: "apply", jobId: j.id }),
        );
        if (j && act("apply", undefined, j.id)) continue;
      }
      if (shiftToday(s) && s.ap >= 2) {
        act("work");
        continue;
      }
      if (!act("gig")) act("rest");
    }
    s = advanceDay(s);
    for (const [zone, t] of Object.entries(s.strategic.territories)) {
      ok(t.controller === s.zones[zone].controller);
      for (const q of Object.values(t.factions))
        for (const n of Object.values(q))
          ok(Number.isFinite(n) && n >= 0 && n <= 100);
      for (const c of t.changes)
        if (c.day === s.day) changes.push({ zone, ...c });
    }
    for (const f of Object.values(s.factions))
      ok(f.resources >= 0 && f.resources <= 1600);
    for (const c of Object.values(s.characters))
      ok(c.wallet.clean >= 0 && c.wallet.illicit >= 0);
    if (reload) s = deserialize(serialize(s));
    times.push(performance.now() - start);
  }
  const p = s.characters.player;
  return {
    s,
    summary: {
      seed,
      mode,
      days: s.day - 1,
      actions,
      wallet: p.wallet,
      arrears: s.street.arrears,
      authority: p.authority,
      advancementMissing: promotionRequirements(s).missing,
      businesses: s.strategic.businesses.map((b) => ({
        name: b.definition,
        status: b.status,
        net: b.totalNet,
        condition: b.condition,
      })),
      factions: Object.values(s.factions).map((f) => ({
        id: f.id,
        resources: Math.round(f.resources),
        instability: Math.round(f.instability),
        decisions: s.strategic.strategies[f.id].history.reduce(
          (n, h) => ((n[h.kind] = (n[h.kind] ?? 0) + 1), n),
          {},
        ),
        controls: Object.values(s.zones).filter((z) => z.controller === f.id)
          .length,
      })),
      territories: Object.values(s.zones).map((z) => ({
        id: z.id,
        controller: z.controller,
        presence: z.organizations,
        contested: s.strategic.territories[z.id].contested,
      })),
      changes,
      arrests: s.street.custody.filter((c) => c.character === "player").length,
      events: s.events.length,
      majorEvents: s.events.filter((e) =>
        ["major", "critical"].includes(e.importance),
      ).length,
      saveBytes: serialize(s).length,
      averageDayMs: Math.round(times.reduce((n, t) => n + t, 0) / times.length),
      maxDayMs: Math.round(Math.max(...times)),
    },
  };
}
try {
  for (const seed of [1, 21, 2026])
    for (const mode of process.env.CAMPAIGN_MODES
      ? process.env.CAMPAIGN_MODES.split(",")
      : [
          "passive",
          "business",
          "political",
          "mixed",
          "custody",
          "changing-control",
        ]) {
      const a = campaign(seed, mode, false),
        b = campaign(seed, mode, true);
      deepStrictEqual(JSON.parse(serialize(a.s)), JSON.parse(serialize(b.s)));
      results = results.filter((r) => r.seed !== seed || r.mode !== mode);
      results.push(a.summary);
      writeFileSync(
        "/tmp/hood-campaign-partial.json",
        JSON.stringify(results, null, 2),
      );
      console.log(
        seed,
        mode,
        "changes",
        a.summary.changes.length,
        "authority",
        a.summary.authority,
        "cash",
        Math.floor(a.summary.wallet.clean),
      );
    }
  writeFileSync(
    "docs/validation/GOAL_007_CAMPAIGNS.json",
    JSON.stringify(
      {
        days: 180,
        campaigns: results.length,
        replayCampaigns: results.length,
        deterministic: true,
        results,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await v.close();
}
