import { describe, it, expect } from "vitest";
import { newGame } from "../core/Simulation";
import { advanceDay } from "../core/TimeSystem";
import { player, type GameState, type ZoneId } from "../core/GameState";
import {
  applyInfluence,
  resolveTerritories,
  stabilizedControl,
} from "../systems/Territory";
import { advanceFactions } from "../systems/Factions";
import {
  politicalAction,
  politicalError,
  promotionRequirements,
  promote,
  appointSuccessor,
  successorError,
} from "../systems/Politics";
import { businessAction, advanceBusinesses } from "../systems/Businesses";
import {
  evaluateEnd,
  finalizeEnding,
  legitimateProgress,
  retire,
} from "../systems/EndConditions";
import { connect } from "../systems/Relationships";
import { serialize, deserialize } from "../persistence/SaveSystem";
import { payArrears } from "../systems/Economy";
import { underlordReady, consolidate } from "./strategicFixtures";
const fresh = () => newGame("Test(7)", "south", 17);
describe("authoritative territory and reusable effects", () => {
  it("preserves canon and simultaneous Nawf competitors", () => {
    const s = fresh();
    expect(s.strategic.territories.nawf.contested).toBe(true);
    expect(s.zones.nawf.controller).toBeNull();
    expect(s.strategic.territories.nawf.factions.blips.presence).toBe(75);
    expect(s.strategic.territories.nawf.factions.muds.presence).toBe(75);
    expect(s.zones.rio.controller).toBe("angels");
    expect(s.zones.downtown.controller).toBeNull();
  });
  it("economic presence and personal support never directly assign control; effects are bounded and attributed", () => {
    const s = fresh();
    for (let n = 0; n < 50; n++)
      applyInfluence(s, {
        actor: "player",
        faction: "backstreet",
        zone: "downtown",
        kind: "economic",
        magnitude: 999,
        cause: "Trade",
      });
    expect(s.zones.downtown.controller).toBeNull();
    expect(s.strategic.territories.downtown.factions.backstreet.economy).toBe(
      100,
    );
    expect(s.events.at(-1)?.factionId).toBe("backstreet");
    expect(s.strategic.effects.at(-1)?.eventId).toBe(s.events.at(-1)?.id);
    const before = serialize(s);
    expect(() =>
      applyInfluence(s, {
        actor: "missing",
        faction: null,
        zone: "south",
        kind: "support",
        magnitude: 1,
        cause: "Bad",
      }),
    ).toThrow();
    expect(serialize(s)).toBe(before);
  });
  it("requires stabilization, prevents repeated same-day resolution, and supports loss and recovery", () => {
    let s = fresh();
    consolidate(s, ["downtown"], "blocks");
    expect(s.zones.downtown.controller).toBe("blocks");
    const t = s.strategic.territories.downtown;
    expect(t.changes).toHaveLength(1);
    const counter = t.candidateDays;
    resolveTerritories(s);
    expect(t.candidateDays).toBe(counter);
    for (let d = 0; d < 11; d++) {
      s.day++;
      t.factions.blocks = {
        presence: 0,
        influence: 0,
        economy: 0,
        support: 0,
        pressure: 0,
      };
      resolveTerritories(s);
    }
    expect(t.controller).toBeNull();
    consolidate(s, ["downtown"], "blocks");
    expect(t.controller).toBe("blocks");
    expect(t.changes).toHaveLength(3);
    expect(t.changes[1].day - t.changes[0].day).toBeGreaterThanOrEqual(10);
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it("a one-point score advantage cannot take territory", () => {
    const s = fresh();
    const t = s.strategic.territories.nawf;
    for (const id of ["blips", "muds"] as const)
      t.factions[id] = {
        presence: 90,
        influence: id === "blips" ? 91 : 90,
        economy: 90,
        support: 90,
        pressure: 0,
      };
    for (let d = 0; d < 15; d++) {
      s.day++;
      resolveTerritories(s);
    }
    expect(t.controller).toBeNull();
  });
});
describe("condition-driven factions and player politics", () => {
  it("recovers from depletion, respects alliance boundaries, retains canonical leaders", () => {
    const s = fresh();
    s.factions.blocks.resources = 0;
    s.factions.blocks.instability = 90;
    s.day = 4;
    advanceFactions(s);
    expect(s.strategic.strategies.blocks.lastDecision).toBe("recover");
    expect(s.factions.blocks.resources).toBeGreaterThan(0);
    expect(s.factions.blips.enemies).toEqual(["muds"]);
    expect(s.factions.angels.enemies).toEqual(["blocks"]);
    expect(s.characters.loco.status).toBe("arrested");
    expect(s.characters.pablo.status).toBe("active");
  });
  it("local community support works unaffiliated with money, AP and cooldown", () => {
    const s = fresh();
    const r = politicalAction(s, "community", "south");
    expect(r.error).toBeNull();
    expect(player(r.state).wallet.clean).toBe(100);
    expect(r.state.ap).toBe(1);
    expect(r.state.zones.south.support).toBeGreaterThan(s.zones.south.support);
    expect(politicalError(r.state, "community", "south")).toContain("day");
    expect(politicalError(s, "support", "south")).toContain("Join");
    expect(s.zones.south.controller).toBe("backstreet");
  });
  it("requires contact access and authority; contributions change persistent organizational state", () => {
    const s = fresh(),
      p = player(s);
    p.affiliation = "backstreet";
    p.authority = 25;
    p.wallet.clean = 500;
    expect(politicalError(s, "operation", "south", "justice")).toContain(
      "Known of",
    );
    connect(s, "player", "justice");
    s.characters.justice.relationships.player.trust = 60;
    const r = politicalAction(s, "operation", "south", "justice");
    expect(r.error).toBeNull();
    expect(r.state.strategic.contributions.backstreet).toBe(50);
    expect(
      r.state.strategic.territories.south.factions.backstreet.economy,
    ).toBeGreaterThan(
      s.strategic.territories.south.factions.backstreet.economy,
    );
    expect(politicalError(s, "challenge", "south", "justice")).toContain("45");
  });
  it("advancement considers time, resources, standing, leadership and political opposition", () => {
    const s = fresh(),
      p = player(s);
    p.affiliation = "backstreet";
    p.authority = 10;
    s.strategic.membershipDay = 1;
    expect(promotionRequirements(s).missing.length).toBeGreaterThan(3);
    s.day = 15;
    p.organizationStanding.backstreet = 60;
    s.strategic.contributions.backstreet = 120;
    connect(s, "player", "justice");
    s.characters.justice.relationships.player.trust = 60;
    s.factions.backstreet.instability = 50;
    expect(promotionRequirements(s).missing).toEqual([]);
    const r = promote(s);
    expect(r.error).toBeNull();
    expect(player(r.state).authority).toBe(25);
    expect(r.state.characters.justice.status).toBe("active");
    expect(promotionRequirements(r.state).missing.length).toBeGreaterThan(0);
  });
});
describe("legitimate assets and provenance", () => {
  function owner(illicit = false) {
    const s = fresh();
    player(s).wallet = {
      clean: illicit ? 0 : 3000,
      illicit: illicit ? 3000 : 0,
    };
    player(s).legitimacy = 50;
    const r = businessAction(s, "repair", "buy");
    expect(r.error).toBeNull();
    return r.state;
  }
  it("charges acquisition; accounts gross, expenses, net and a single asset value", () => {
    const s = owner(),
      p = player(s);
    expect(p.wallet.clean).toBe(1200);
    expect(s.assets).toHaveLength(1);
    const cash = p.wallet.clean;
    s.day++;
    advanceBusinesses(s);
    const h = s.strategic.businesses[0].history[0];
    expect(p.wallet.clean - cash).toBe(h.revenue - h.expenses);
    expect(s.ledger.slice(-2).map((e) => e.amount)).toEqual([
      h.revenue,
      -h.expenses,
    ]);
    expect(legitimateProgress(s).wealth).toBe(
      p.wallet.clean + s.assets[0].value,
    );
  });
  it("retains illicit provenance through operating revenue and sale", () => {
    let s = owner(true);
    s.day++;
    advanceBusinesses(s);
    expect(s.assets[0].provenance).toBe("illicit");
    expect(player(s).wallet.clean).toBe(0);
    expect(legitimateProgress(s).wealth).toBe(0);
    s.ap = 2;
    s = businessAction(s, "repair", "sell").state;
    expect(player(s).wallet.clean).toBe(0);
    expect(s.assets[0].value).toBe(0);
    expect(s.assets[0].recurringIncome).toBe(0);
  });
  it.each(["sell", "close"] as const)(
    "%s stops recurring income and future revenue",
    (action) => {
      let s = owner();
      s.day++;
      advanceBusinesses(s);
      s.ap = 2;
      s = businessAction(s, "repair", action).state;
      const wallet = player(s).wallet.clean;
      s.day++;
      advanceBusinesses(s);
      expect(player(s).wallet.clean).toBe(wallet);
      expect(s.assets[0].value).toBe(0);
      expect(s.assets[0].recurringIncome).toBe(0);
      expect(deserialize(serialize(s))).toEqual(s);
    },
  );
  it("poor conditions cause losses, maintenance and arrears cost actual money", () => {
    let s = owner();
    const b = s.strategic.businesses[0];
    b.condition = 0;
    s.strategic.territories.south.lawfulEconomy = 0;
    s.zones.south.support = 0;
    s.day++;
    advanceBusinesses(s);
    expect(b.lastNet).toBeLessThan(0);
    s.ap = 2;
    const cash = player(s).wallet.clean;
    s = businessAction(s, "repair", "maintain").state;
    expect(player(s).wallet.clean).toBe(cash - 120);
    expect(s.strategic.businesses[0].condition).toBe(30);
    s.street.arrears = 50;
    s = payArrears(s).state;
    expect(s.street.arrears).toBe(0);
    expect(player(s).wallet.clean).toBe(cash - 170);
  });
});
describe("complete victory conditions", () => {
  it("Underlord requires an appointed eligible successor and stabilized actual territory; triggers once", () => {
    let s = underlordReady();
    expect(stabilizedControl(s, "angels")).toBe(4);
    expect(evaluateEnd(s)).toBeNull();
    const r = appointSuccessor(s, "joker");
    expect(r.error).toBeNull();
    s = r.state;
    finalizeEnding(s);
    expect(s.end).toBe("underlord");
    const count = s.events.length;
    finalizeEnding(s);
    expect(s.events).toHaveLength(count);
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it.each([
    "membership",
    "authority",
    "territory",
    "stabilization",
    "personal-set",
    "availability",
    "loyalty",
    "trust",
    "hostility",
    "affiliation",
    "death",
  ])("rejects missing Underlord condition: %s", (condition) => {
    const s = underlordReady(),
      p = player(s),
      heir = s.characters.joker;
    s.crew.successor = "joker";
    if (condition === "membership") p.affiliation = null;
    if (condition === "authority") p.authority = 69;
    if (condition === "territory")
      s.strategic.territories.downtown.controller = null;
    if (condition === "stabilization")
      s.strategic.territories.downtown.controlSince = s.day;
    if (condition === "personal-set") s.crew.members = [];
    if (condition === "availability") heir.availableDay = s.day + 1;
    if (condition === "loyalty") heir.traits.loyalty = 59;
    if (condition === "trust") heir.relationships.player.trust = 59;
    if (condition === "hostility") heir.relationships.player.grievance = 40;
    if (condition === "affiliation") heir.affiliation = "blocks";
    if (condition === "death") heir.status = "dead";
    expect(evaluateEnd(s)).toBeNull();
  });
  function exitReady() {
    const s = fresh();
    player(s).wallet.clean = 100000;
    player(s).recurringLawfulIncome = 24;
    s.strategic.lawfulStreak = 14;
    s.day = 40;
    return s;
  }
  it("retirement is voluntary, persistent, and not automatic at the wealth threshold", () => {
    const s = exitReady();
    expect(evaluateEnd(s)).toBeNull();
    const r = retire(s);
    expect(r.error).toBeNull();
    expect(r.state.end).toBe("legitimate-exit");
    expect(deserialize(serialize(r.state))).toEqual(r.state);
  });
  it.each([
    "wealth",
    "income",
    "sustained",
    "dirty",
    "recent-crime",
    "recent-illicit",
    "arrears",
    "custody",
  ])("rejects missing Legitimate Exit condition: %s", (condition) => {
    const s = exitReady(),
      p = player(s);
    if (condition === "wealth") p.wallet.clean = 99999;
    if (condition === "income") p.recurringLawfulIncome = 23;
    if (condition === "sustained") s.strategic.lawfulStreak = 13;
    if (condition === "dirty") p.wallet.illicit = 1;
    if (condition === "recent-crime") s.strategic.lastCrimeDay = 39;
    if (condition === "recent-illicit")
      s.ledger.push({
        day: 39,
        amount: 1,
        provenance: "illicit",
        reason: "Crime",
      });
    if (condition === "arrears") s.street.arrears = 1;
    if (condition === "custody") p.status = "arrested";
    expect(retire(s).error).toBeTruthy();
  });
});

it("rejects four cosmetic labels and validates actual business income once per day", () => {
  const fake = fresh();
  player(fake).affiliation = "angels";
  player(fake).authority = 70;
  fake.crew.successor = "joker";
  fake.characters.joker.affiliation = "angels";
  for (const z of Object.values(fake.zones)) z.controller = "angels";
  expect(evaluateEnd(fake)).toBeNull();
  let s = fresh();
  player(s).wallet.clean = 120000;
  player(s).legitimacy = 60;
  s = businessAction(s, "laundry", "buy").state;
  for (let i = 0; i < 35; i++) s = advanceDay(s);
  const b = s.strategic.businesses[0],
    h = b.history.at(-1)!;
  const lastRevenue = s.ledger.filter(
    (l) => l.day === s.day && l.reason.includes("operating revenue"),
  );
  expect(lastRevenue).toHaveLength(1);
  expect(lastRevenue[0].amount).toBe(h.revenue);
  expect(
    s.ledger.filter(
      (l) => l.day === s.day && l.reason === "Recurring lawful income",
    ),
  ).toHaveLength(0);
  expect(legitimateProgress(s).missing).toEqual([]);
  expect(evaluateEnd(s)).toBeNull();
  expect(retire(s).state.end).toBe("legitimate-exit");
});

it("daily business settlement is idempotent and duplicate assets cannot be loaded", () => {
  let s = fresh();
  player(s).wallet.clean = 3000;
  player(s).legitimacy = 30;
  s = businessAction(s, "repair", "buy").state;
  s.day++;
  advanceBusinesses(s);
  const raw = serialize(s);
  advanceBusinesses(s);
  expect(serialize(s)).toBe(raw);
  s.assets.push({ ...s.assets[0] });
  expect(() => deserialize(serialize(s))).toThrow(/strategic/);
});
