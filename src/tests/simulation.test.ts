import { requestActivity, availability } from "../systems/CrewAgency";
import { describe, expect, it } from "vitest";
import { newGame } from "../core/Simulation";
import { advanceDay } from "../core/TimeSystem";
import {
  ACTIONS,
  performAction,
  validateAction,
  type ActionType,
} from "../core/ActionEngine";
import { cash, player, type GameState, type ZoneId } from "../core/GameState";
import { evaluateEnd } from "../systems/EndConditions";
import { change } from "../systems/Relationships";
import { spend } from "../systems/Economy";
import {
  deserialize,
  serialize,
  saveGame,
  loadGame,
} from "../persistence/SaveSystem";
import { BALANCE } from "../content/balance";
const zones: ZoneId[] = ["downtown", "rio", "south", "reservoir", "nawf"];
function doAction(s: GameState, type: ActionType, target?: string, extra = {}) {
  const r = performAction(s, {
    type,
    target,
    actor: s.playerId,
    incidentId: "the-chains",
    ...extra,
  });
  expect(r.error, `${type} at day ${s.day}`).toBeNull();
  return r.state;
}
function fresh(seed = 2026, home: ZoneId = "south") {
  return newGame("Morgan", home, seed);
}
function info(s: GameState) {
  return doAction(s, "contact", "mega");
}
function invariants(s: GameState) {
  expect(s.ap).toBeGreaterThanOrEqual(0);
  expect(s.ap).toBeLessThanOrEqual(2);
  expect(Object.keys(s.factions)).toHaveLength(5);
  expect(new Set(s.crew.members).size).toBe(s.crew.members.length);
  expect(s.crew.members.length).toBeLessThanOrEqual(s.crew.capacity);
  for (const c of Object.values(s.characters)) {
    expect(c.wallet.clean).toBeGreaterThanOrEqual(0);
    expect(c.wallet.illicit).toBeGreaterThanOrEqual(0);
  }
  expect(deserialize(serialize(s))).toEqual(s);
}
describe("world and canon", () => {
  it("initializes exactly five zones and five established organizations", () => {
    const s = fresh();
    expect(Object.keys(s.zones)).toHaveLength(5);
    expect(Object.keys(s.factions)).toHaveLength(5);
    expect(s.zones.downtown.controller).toBeNull();
    expect(s.zones.downtown.organizations).toEqual([]);
    expect(s.zones.nawf.organizations).toEqual(["blips", "muds"]);
    expect(s.zones.reservoir.name).toBe("The Reservoir");
  });
  it.each(zones)(
    "starts in %s while preserving incident participants and finances",
    (home) => {
      const s = fresh(5, home);
      expect(player(s).home).toBe(home);
      expect(player(s).affiliation).toBeNull();
      expect(cash(player(s))).toBe(125);
      expect(s.ap).toBe(2);
      expect(s.crew).toEqual({
        members: ["flacco"],
        capacity: 1,
        successor: null,
      });
      expect(s.incidents["the-chains"].participants).toEqual([
        "dizzy",
        "babycanon",
        "joker",
      ]);
      expect(s.incidents["the-chains"].victim).toBe("mega");
      expect(s.properties.chains.possession).toEqual({
        kind: "group",
        id: "the-chains",
      });
      expect(s.characters.mega.affiliation).toBe("backstreet");
    },
  );
  it("keeps Loco influential while incarcerated and Pablo active", () => {
    const s = fresh();
    expect(s.characters.loco.status).toBe("arrested");
    expect(s.characters.loco.influence).toBe(90);
    expect(s.characters.pablo.status).toBe("active");
  });
  it("does not propagate hostility through organizational allies", () => {
    const s = fresh();
    change(s.characters.pablo, "player", { trust: -80, grievance: 80 });
    expect(s.factions.angels.allies).toContain("muds");
    expect(player(s).organizationStanding.muds).toBe(0);
    expect(s.factions.muds.enemies).not.toContain("backstreet");
    expect(
      s.characters["contact-muds"].relationships.player?.grievance ?? 0,
    ).toBe(0);
  });
  it("maintains independent directed relationships and shared-event memories", () => {
    const s = fresh();
    const before = structuredClone(player(s).relationships.mega);
    change(s.characters.mega, "player", { trust: -20 });
    expect(player(s).relationships.mega).toEqual(before);
    expect(s.characters.dizzy.relationships.joker.trust).not.toBe(
      s.characters.joker.relationships.dizzy.trust,
    );
    expect(s.characters.dizzy.memories[0].eventId).toBe(
      s.characters.babycanon.memories[0].eventId,
    );
  });
});
describe("actions, economy, AP and persistence", () => {
  it("cannot pay the initial $150 demand with $125", () => {
    const s = info(fresh());
    const r = performAction(s, {
      type: "buyback",
      actor: "player",
      incidentId: "the-chains",
    });
    expect(r.error).toMatch(/Insufficient/);
    expect(r.state).toBe(s);
    expect(cash(player(s))).toBe(125);
  });
  it("validates money, rejects invalid transfers and never overdraws", () => {
    const s = fresh(),
      p = player(s);
    expect(spend(p, 126)).toBeNull();
    expect(spend(p, -1)).toBeNull();
    expect(spend(p, NaN)).toBeNull();
    expect(spend(p, Infinity)).toBeNull();
    expect(cash(p)).toBe(125);
    p.wallet = { clean: 0, illicit: 0 };
    expect(
      validateAction(s, { actor: "player", target: "mega", type: "transfer" }),
    ).toBe("Insufficient cash");
  });
  it("preserves provenance in transfers and spending", () => {
    let s = fresh();
    player(s).wallet = { clean: 5, illicit: 120 };
    const w = structuredClone(s.characters.mega.wallet);
    s = doAction(s, "transfer", "mega");
    expect(s.characters.mega.wallet).toEqual({
      clean: w.clean + 5,
      illicit: w.illicit + 20,
    });
    expect(player(s).wallet).toEqual({ clean: 0, illicit: 100 });
    expect(s.ledger.map((e) => e.provenance)).toEqual(["clean", "illicit"]);
  });
  it("permits two 1AP actions, blocks overspending AP and restores daily AP", () => {
    let s = doAction(fresh(), "gig");
    expect(s.ap).toBe(1);
    expect(performAction(s, { actor: "player", type: "work" }).error).toMatch(
      /AP/,
    );
    s = doAction(s, "rest");
    expect(s.ap).toBe(0);
    expect(performAction(s, { actor: "player", type: "gig" }).error).toMatch(
      /AP/,
    );
    s = advanceDay(s);
    expect(s.ap).toBe(2);
    expect(s.day).toBe(2);
    expect(ACTIONS.work.ap).toBe(2);
  });
  it("does not mutate the input state on successful actions or day advancement", () => {
    const s = fresh(),
      copy = serialize(s);
    doAction(s, "gig");
    expect(serialize(s)).toBe(copy);
    advanceDay(s);
    expect(serialize(s)).toBe(copy);
  });
  it("keeps work and free rest available at zero cash and maximum stress", () => {
    let s = fresh();
    player(s).wallet = { clean: 0, illicit: 0 };
    player(s).stress = 100;
    s = advanceDay(s);
    expect(player(s).status).toBe("active");
    s = doAction(s, "gig");
    expect(cash(player(s))).toBe(38);
    invariants(s);
  });
  it("stores and restores complete memories, incidents, money, RNG, commitments and progression", () => {
    let s = info(fresh());
    requestActivity(s, "flacco", "work");
    const raw = serialize(s);
    const loaded = deserialize(raw);
    expect(loaded).toEqual(s);
    expect(advanceDay(loaded)).toEqual(advanceDay(s));
  });
  it("supports storage round trips and rejects damaged or future saves", () => {
    const map = new Map<string, string>();
    const storage = {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      removeItem: (k: string) => {
        map.delete(k);
      },
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    } satisfies Storage;
    const s = fresh();
    saveGame(storage, s);
    expect(loadGame(storage)).toEqual(s);
    expect(() => deserialize("invalid")).toThrow(/could not be read/);
    const raw = JSON.parse(serialize(s));
    raw.version = 99;
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/version 8/);
    raw.version = 8;
    raw.state.characters.player.wallet.clean = -1;
    expect(() => deserialize(JSON.stringify(raw))).toThrow();
  });
  it("rejects broken entity references and unavailable storage", () => {
    const s = fresh();
    s.crew.members = ["missing"];
    expect(() => deserialize(serialize(s))).toThrow(/references/);
    expect(() =>
      saveGame(
        {
          setItem: () => {
            throw new Error();
          },
        } as unknown as Storage,
        fresh(),
      ),
    ).toThrow(/unavailable/);
  });
  it("reproduces the same outcomes for identical seeds and action sequences", () => {
    const play = () => {
      let s = info(fresh(17));
      s = doAction(s, "negotiate");
      s = advanceDay(s);
      s = doAction(s, "recover");
      for (let i = 0; i < 6; i++) s = advanceDay(s);
      return s;
    };
    expect(play()).toEqual(play());
  });
});
describe("living simulation and personal Set", () => {
  it("NPCs choose actions and factions spend resources without player input", () => {
    const s = fresh(),
      next = advanceDay(s);
    expect(next.characters.flacco.wallet.clean).toBeGreaterThan(
      s.characters.flacco.wallet.clean,
    );
    expect(next.characters.flacco.lastActionDay).toBe(next.day);
    expect(next.characters["resident-south"].wallet.clean).toBeGreaterThan(
      s.characters["resident-south"].wallet.clean,
    );
    expect(next.factions.backstreet.instability).toBeLessThan(
      s.factions.backstreet.instability,
    );
    expect(next.factions.blocks.resources).not.toBe(
      s.factions.blocks.resources,
    );
  });
  it("regular NPC status and availability govern crew assignments", () => {
    let s = fresh();
    s.characters.flacco.status = "arrested";
    expect(
      validateAction(s, { actor: "player", target: "flacco", type: "assign" }),
    ).toMatch(/unavailable/);
    s.characters.flacco.status = "active";
    requestActivity(s, "flacco", "work");
    expect(availability(s, s.characters.flacco)).toMatch(/committed/);
    const cashBefore = cash(player(s));
    s = advanceDay(s);
    expect(s.commitments[0].status).toMatch(/fulfilled|failed/);
    expect(s.characters.flacco.skills.work).toBe(
      s.assignments[0].success ? 31 : 30,
    );
    expect(cash(player(s))).toBe(
      cashBefore + (s.assignments[0].success ? 29 : 0) - 18,
    );
  });
  it("removal preserves Flacco identity, memories and relationship history", () => {
    let s = doAction(fresh(), "socialize", "flacco");
    const before = structuredClone(s.characters.flacco);
    s = doAction(s, "remove", "flacco");
    expect(s.crew.members).toEqual([]);
    expect(s.characters.flacco.id).toBe(before.id);
    expect(s.characters.flacco.relationships.player.trust).toBeLessThan(
      before.relationships.player.trust,
    );
    expect(
      s.characters.flacco.memories.slice(0, before.memories.length),
    ).toEqual(before.memories);
    s = advanceDay(s);
    s = doAction(s, "gig");
    expect(s.ap).toBe(1);
  });
  it("recruits an ordinary civilian through repeated trust building", () => {
    let s = fresh();
    for (let i = 0; i < 5; i++) {
      s = doAction(s, "socialize", "resident-south");
      s = advanceDay(s);
    }
    expect(s.crew.capacity).toBeGreaterThan(1);
    s = doAction(s, "recruit", "resident-south");
    expect(s.crew.members).toContain("resident-south");
    expect(s.characters["resident-south"].affiliation).toBeNull();
    expect(Object.keys(s.factions)).toHaveLength(5);
  });
  it("gates affiliation through a member’s trust and organizational standing", () => {
    let s = fresh();
    s = doAction(s, "introduce", "mega");
    expect(
      validateAction(s, {
        type: "affiliate",
        actor: "player",
        target: "justice",
      }),
    ).toMatch(/35/);
    for (let i = 0; i < 5; i++) {
      s = doAction(s, "standing", "justice");
      s = advanceDay(s);
    }
    s = doAction(s, "affiliate", "justice");
    expect(player(s).affiliation).toBe("backstreet");
    expect(player(s).authority).toBe(10);
    expect(s.crew.members).toContain("flacco");
    expect(Object.keys(s.factions)).toHaveLength(5);
    expect(evaluateEnd(s)).toBeNull();
  });
});
describe("The Chains and automated playthroughs", () => {
  it.each(["downtown", "south"] as ZoneId[])(
    "engages, earns money, buys back and continues from %s",
    (home) => {
      let s = info(fresh(21, home));
      s = doAction(s, "gig");
      s = advanceDay(s);
      s = doAction(s, "gig");
      expect(cash(player(s))).toBeGreaterThanOrEqual(150);
      s = doAction(s, "buyback");
      expect(s.incidents["the-chains"].status).toBe("resolved");
      expect(s.properties.chains.possession).toEqual({
        kind: "character",
        id: "mega",
      });
      s = advanceDay(s);
      s = doAction(s, "gig");
      s = advanceDay(s);
      s = doAction(s, "gig");
      expect(s.progression.jobs).toBe(4);
      invariants(s);
    },
  );
  it("ignores the incident while continuing repeatable legitimate work", () => {
    let s = fresh();
    for (let d = 0; d < 20; d++) {
      s = doAction(s, "gig");
      s = advanceDay(s);
      invariants(s);
    }
    expect(s.incidents["the-chains"].status).not.toBe("active");
    expect(s.end).toBeNull();
    expect(cash(player(s))).toBeGreaterThan(125);
  });
  it("earns legitimate money before contacting anyone", () => {
    let s = doAction(fresh(), "gig");
    expect(cash(player(s))).toBe(163);
    s = advanceDay(s);
    s = doAction(s, "gig");
    s = info(s);
    s = advanceDay(s);
    s = doAction(s, "buyback");
    expect(s.incidents["the-chains"].resolution).toBe("buyback");
  });
  it("allows peaceful leadership settlement without paying", () => {
    let s = info(fresh(20));
    s = doAction(s, "settlement", "pablo");
    for (let d = 0; d < 8; d++) s = advanceDay(s);
    expect(s.incidents["the-chains"].status).not.toBe("active");
    expect(s.characters.pablo.memories.some((m) => m.about === "player")).toBe(
      true,
    );
    s = doAction(s, "gig");
    invariants(s);
  });
  it.each([1, 8, 20, 40])(
    "runs abstract high-risk recovery without softlocks (seed %i)",
    (seed) => {
      let s = info(fresh(seed));
      s = advanceDay(s);
      s = doAction(s, "recover");
      expect(player(s).police).toBeGreaterThan(0);
      expect(player(s).rivalThreat).toBeGreaterThan(0);
      for (let d = 0; d < 10; d++) {
        s = advanceDay(s);
        s = doAction(s, "gig");
        invariants(s);
      }
      expect(s.end).toBeNull();
    },
  );
  it("has no fixed turn limit and no arbitrary defeat timer", () => {
    let s = fresh();
    for (let d = 0; d < 160; d++) {
      s = doAction(s, "gig");
      s = advanceDay(s);
    }
    expect(s.day).toBe(161);
    expect(s.end).toBeNull();
    expect(s.characters.player.status).toBe("active");
  }, 20000);
});
describe("constructed end condition fixtures", () => {
  it("ordinary arrest continues the campaign; death ends it", () => {
    const s = fresh();
    player(s).status = "arrested";
    expect(evaluateEnd(s)).toBeNull();
    player(s).status = "dead";
    expect(evaluateEnd(s)).toBe("killed");
  });
  it("requires clean wealth, recurring lawful support and formal retirement", () => {
    const s = fresh();
    player(s).wallet.clean = BALANCE.cleanWealthVictory;
    player(s).recurringLawfulIncome = BALANCE.recurringIncomeVictory;
    expect(evaluateEnd(s)).toBeNull();
    s.strategic.lawfulStreak = 14;
    s.progression.retired = true;
    expect(evaluateEnd(s)).toBe("legitimate-exit");
    player(s).recurringLawfulIncome = 0;
    expect(evaluateEnd(s)).toBeNull();
    s.assets.push({
      id: "lawful-business",
      owner: "player",
      value: 500,
      provenance: "clean",
      recurringIncome: 24,
    });
    expect(evaluateEnd(s)).toBe("legitimate-exit");
  });
  it("excludes illicit assets and current dependence, but allows a lawful exit after past crime", () => {
    const s = fresh();
    s.strategic.lawfulStreak = 14;
    s.progression.retired = true;
    player(s).recurringLawfulIncome = 24;
    s.assets.push({
      id: "illicit",
      owner: "player",
      value: 100000,
      provenance: "illicit",
      recurringIncome: 100,
    });
    expect(evaluateEnd(s)).toBeNull();
    player(s).wallet.clean = 100000;
    s.progression.illicitEarned = 72;
    s.ledger.push({
      day: 1,
      amount: 72,
      provenance: "illicit",
      reason: "Past crime",
    });
    expect(evaluateEnd(s)).toBeNull();
    s.day = 32;
    expect(evaluateEnd(s)).toBe("legitimate-exit");
  });
  it("never awards Underlord to an independent player or a personal Set", () => {
    const s = fresh();
    for (const z of Object.values(s.zones)) z.controller = "angels";
    player(s).authority = 100;
    s.crew.successor = "flacco";
    expect(evaluateEnd(s)).toBeNull();
  });
  it("requires four established-gang zones, authority and an eligible Set successor", () => {
    const s = fresh(),
      p = player(s);
    p.affiliation = "angels";
    p.authority = 70;
    s.crew.successor = "flacco";
    s.characters.flacco.affiliation = "angels";
    for (const id of zones.slice(0, 3)) s.zones[id].controller = "angels";
    expect(evaluateEnd(s)).toBeNull();
    s.zones.reservoir.controller = "angels";
    for (const id of zones.slice(0, 4)) {
      s.strategic.territories[id].controller = "angels";
      s.strategic.territories[id].controlSince = 1;
    }
    s.day = 9;
    s.characters.flacco.traits.loyalty = 70;
    s.characters.flacco.relationships.player.trust = 70;
    expect(evaluateEnd(s)).toBe("underlord");
    p.authority = 69;
    expect(evaluateEnd(s)).toBeNull();
    p.authority = 70;
    s.characters.flacco.status = "arrested";
    expect(evaluateEnd(s)).toBeNull();
    s.characters.flacco.status = "active";
    s.crew.members = [];
    expect(evaluateEnd(s)).toBeNull();
  });
});

describe("regression checks for autonomous schedules and ordinary crew members", () => {
  it("limits NPC actions independently of player AP without locking recruitment", () => {
    let s = fresh();
    const npc = s.characters["resident-south"];
    npc.relationships.player.trust = 60;
    player(s).influence = 6;
    s = advanceDay(s);
    expect(s.ap).toBe(2);
    expect(validateAction(s, { type: "gig", actor: npc.id })).toMatch(
      /availability/,
    );
    expect(
      validateAction(s, { type: "recruit", actor: "player", target: npc.id }),
    ).toBeNull();
    s = doAction(s, "recruit", npc.id);
    expect(s.crew.members).toContain(npc.id);
  });
  it("allows removing an inactive member and logs a failed commitment", () => {
    let s = fresh();
    requestActivity(s, "flacco", "work");
    s.characters.flacco.status = "arrested";
    s = advanceDay(s);
    expect(s.commitments[0].status).toBe("failed");
    s = doAction(s, "remove", "flacco");
    expect(s.crew.members).not.toContain("flacco");
    expect(s.characters.flacco.status).toBe("arrested");
  });
  it("rejects attempts to create a sixth organization through the action boundary", () => {
    const s = fresh();
    const invalid = {
      actor: "player",
      type: "create-gang",
    } as unknown as Parameters<typeof performAction>[1];
    expect(performAction(s, invalid)).toEqual({
      state: s,
      error: "Unknown action",
    });
    expect(Object.keys(s.factions)).toHaveLength(5);
  });
  it("never adds resources or consumes randomness for an ineligible action", () => {
    const s = fresh();
    const before = serialize(s);
    const result = performAction(s, {
      actor: "player",
      type: "buy",
      item: "music",
    });
    expect(result.error).toBeNull();
    const repeated = performAction(result.state, {
      actor: "player",
      type: "buy",
      item: "music",
    });
    expect(repeated.error).not.toBeNull();
    expect(repeated.state).toBe(result.state);
    expect(serialize(s)).toBe(before);
  });
});

it("preserves an incarcerated leader’s practical influence on organization decisions", () => {
  const alive = fresh();
  const absent = fresh();
  absent.characters.loco.status = "dead";
  const withLeader = advanceDay(alive);
  const withoutLeader = advanceDay(absent);
  expect(withLeader.factions.angels.influence.rio).toBeGreaterThan(
    withoutLeader.factions.angels.influence.rio,
  );
});
