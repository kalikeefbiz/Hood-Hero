import { acquire, transact } from "../systems/StreetEconomy";
import { connect } from "../systems/Relationships";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newGame } from "../core/Simulation";
import { player, type GameState } from "../core/GameState";
import * as Random from "../core/Random";
import { record, visibleEvents } from "../core/EventLog";
import { advanceDay, recoverInHospital } from "../core/TimeSystem";
import { performAction, performActionAt } from "../core/ActionEngine";
import { moveTo, presenceOf, assessRisk } from "../board/presence";
import { deriveBoardView } from "../board/viewModel";
import { deserialize, serialize } from "../persistence/SaveSystem";
import {
  currentEncounter,
  dismissEncounter,
  respondEncounter,
  syncEncounters,
} from "../systems/Encounters";
import {
  addGrievance,
  advanceConflicts,
  exceptionalFatalityRoll,
  expose,
  hospitalize,
  hospitalStay,
  lethalConflict,
  sceneDialogue,
  streetConversation,
  warRecognized,
  witnessIdentity,
} from "../systems/Danger";

function world(npc = "resident-nawf", seed = 2026) {
  const s = newGame("Morgan", "south", seed);
  for (const c of Object.values(s.characters))
    if (c.id !== s.playerId && c.id !== npc) c.availableDay = 999;
  return s;
}
function evidence(s: GameState, npc: string, membership = false) {
  const e = record(s, "social", "A direct introduction", [npc, s.playerId]);
  witnessIdentity(s, npc, s.playerId, e.id, "nawf.deli", "witness", membership);
}
function beef(s: GameState, npc: string, serious = 28, lethal = false) {
  const e = record(s, "social", "An unfinished disagreement", [
    npc,
    s.playerId,
  ]);
  return addGrievance(
    s,
    npc,
    s.playerId,
    "An unfinished disagreement",
    e.id,
    serious,
    lethal,
  );
}
function roll(value = 0.05) {
  return vi.spyOn(Random, "random").mockReturnValue(value);
}
afterEach(() => vi.restoreAllMocks());

describe("contextual street life", () => {
  it("ordinary civilians can cross contested neighborhoods without automatic violence", () => {
    for (let seed = 1; seed <= 250; seed++) {
      let s = world("resident-nawf", seed);
      s = moveTo(s, "nawf.deli");
      if (streetConversation(s))
        s = respondEncounter(s, currentEncounter(s)!.id, "listen").state;
      s = moveTo(s, "nawf.bodega");
      expect(player(s).status).toBe("active");
      expect(s.danger.conflicts).toHaveLength(0);
      expect(s.danger.injuries).toHaveLength(0);
    }
  });
  it("creates an identifiable contextual encounter and peacefully connects neighbors", () => {
    roll();
    let s = moveTo(world(), "nawf.deli");
    const e = currentEncounter(s)!;
    expect(e.participants).toContain("resident-nawf");
    expect(sceneDialogue(s, streetConversation(s)!)).toMatch(/steady work/);
    s = respondEncounter(s, e.id, "listen").state;
    expect(s.danger.conflicts).toHaveLength(0);
    expect(player(s).connections).toContain("resident-nawf");
    expect(s.danger.scenes[0].outcome).toMatch(/peacefully/);
    expect(respondEncounter(s, e.id, "disrespect").state).toBe(s);
  });
  it("persists disrespect as personal beef, permits later encounters and reconciliation", () => {
    const rng = roll();
    let s = moveTo(world("contact-muds"), "nawf.deli");
    rng.mockReturnValue(0.95); // walks off, no assault
    s = respondEncounter(s, currentEncounter(s)!.id, "disrespect").state;
    const c = s.danger.conflicts[0];
    expect(c.state).toBe("unresolved");
    expect(c.lethal).toBe(false);
    expect(c.scope).toBe("personal");
    expect(s.factions.muds.enemies).toEqual(["blips"]);
    expect(player(s).rivalThreat).toBe(0);
    expect(
      s.characters["contact-blips"].memories.some(
        (m) => m.eventId === c.originEvent,
      ),
    ).toBe(false);
    s = deserialize(serialize(s));
    expect(s.danger.conflicts[0]).toEqual(c);
    expect(
      s.characters["contact-muds"].memories.some((m) => m.about === s.playerId),
    ).toBe(true);
    s.day++;
    rng.mockReturnValue(0.2); // meets again, chooses conversation over assault
    expose(s, "nawf.deli", "linger");
    syncEncounters(s);
    expect(streetConversation(s)?.motive).toBe("history");
    expect(sceneDialogue(s, streetConversation(s)!)).toMatch(/disrespect/);
    rng.mockReturnValue(0.01);
    s = respondEncounter(s, currentEncounter(s)!.id, "apologize").state;
    expect(s.danger.conflicts[0].state).toBe("settled");
  });
  it("derives a corner objection from an actual transaction and debt from an actual supplier", () => {
    const s = world("contact-muds");
    connect(s, s.playerId, "contact-muds");
    s.characters["contact-muds"].relationships.player.trust = 40;
    player(s).neighborhoodStanding.nawf = 20;
    acquire(s, "contact-muds", "consignment");
    expect(s.street.agreements).toHaveLength(1);
    transact(s, s.playerId, "nawf");
    player(s).status = "active";
    roll();
    expose(s, "nawf.deli", "activity", "2");
    expect(streetConversation(s)?.motive).toBe("corner");
    expect(streetConversation(s)?.contextEvent).toBe(
      s.street.transactions[0].eventId,
    );
    s.danger.scenes[0].status = "resolved";
    s.day = s.street.agreements[0].dueDay;
    expose(s, "nawf.deli", "activity", "2");
    expect(streetConversation(s)?.motive).toBe("debt");
  });
  it("closing a live street scene means leaving, and cannot replay or dodge it through movement", () => {
    roll();
    const s = moveTo(world(), "nawf.deli");
    expect(moveTo(s, "rio.market")).toBe(s);
    expect(performAction(s, { type: "rest", actor: s.playerId }).error).toMatch(
      /encounter/,
    );
    const next = dismissEncounter(s, currentEncounter(s)!.id);
    expect(next.danger.scenes[0].status).toBe("resolved");
    expect(next.danger.scenes[0].outcome).toMatch(/left/);
    expect(next.danger.conflicts).toHaveLength(0);
  });
});

describe("recognition, war and non-linear conflict", () => {
  it("faction war creates immediate danger only with credible membership recognition", () => {
    roll(0.01);
    let s = world("contact-muds");
    player(s).affiliation = "blips";
    evidence(s, "contact-muds");
    expect(warRecognized(s, s.characters["contact-muds"])).toBe(false);
    s = moveTo(s, "nawf.deli");
    expect(hospitalStay(s)).toBeUndefined();
    expect(s.end).toBeNull();
    const disclosed = respondEncounter(
      s,
      currentEncounter(s)!.id,
      "identify",
    ).state;
    expect(warRecognized(disclosed, disclosed.characters["contact-muds"])).toBe(
      true,
    );
    expect(disclosed.end).toBe("killed");
    expect(disclosed.danger.conflicts[0].lethal).toBe(true);
  });
  it("war can produce an immediate shooting with no personal history, or a conversation", () => {
    const rng = roll(0.01);
    let s = world("contact-muds");
    player(s).affiliation = "blips";
    evidence(s, "contact-muds", true);
    s = moveTo(s, "nawf.deli");
    expect(s.end).toBe("killed");
    expect(s.danger.scenes).toHaveLength(0);
    s = world("contact-muds");
    player(s).affiliation = "blips";
    evidence(s, "contact-muds", true);
    rng.mockReturnValue(0.75);
    s = moveTo(s, "nawf.deli");
    expect(streetConversation(s)?.motive).toBe("war");
    expect(s.end).toBeNull();
    expect(s.factions.angels.enemies).not.toContain("blips");
  });
  it("serious personal beef can target a known sighting away from the NPC's home", () => {
    roll(0.01);
    const s = world("joker");
    const c = beef(s, "joker", 90, true);
    c.intent = "seek";
    evidence(s, "joker");
    const next = moveTo(s, "nawf.deli");
    expect(next.end).toBe("killed");
    expect(c.participants).toEqual(["joker", s.playerId]);
  });
  it("allows immediate nonlethal assault from a personal dispute without granting lethal permission", () => {
    roll(0.01);
    const s = world("contact-muds");
    beef(s, "contact-muds", 70, false);
    const next = moveTo(s, "nawf.deli");
    expect(hospitalStay(next)?.kind).toBe("assault");
    expect(next.end).toBeNull();
  });
  it("reconsiders privately without a countdown; associates hear only individual disputes", () => {
    const rng = roll(0.9);
    const s = newGame("Morgan", "south");
    const c = beef(s, "mega", 75, true);
    s.day++;
    const before = visibleEvents(s).length;
    advanceConflicts(s);
    expect(c.state).toBe("unresolved");
    rng
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.9)
      .mockReturnValue(0.9);
    advanceConflicts(s);
    expect(c.state).toBe("worsening");
    expect(c.intent).toBe("involve");
    expect(c.associates.length).toBeGreaterThan(0);
    expect(c.scope).toBe("circle");
    expect(visibleEvents(s)).toHaveLength(before);
    expect(deserialize(serialize(s)).danger.conflicts).toEqual(
      s.danger.conflicts,
    );
  });
  it("allows NPC-only faction conflict and cooling without involving the player", () => {
    roll(0.01);
    const s = newGame("Morgan", "south");
    advanceConflicts(s);
    const c = s.danger.conflicts[0];
    expect(c.participants).not.toContain(s.playerId);
    expect(c.lethal).toBe(true);
    expect(visibleEvents(s).some((e) => e.id === c.originEvent)).toBe(false);
    s.day++;
    advanceConflicts(s);
    expect(c.state).toBe("cooling");
    expect(c.intent).toBe("avoid");
  });
});

describe("bounded exposure and exact exceptional fatalities", () => {
  it("uses exactly one winning integer bucket in 100,000 and rejects the uint32 tail", () => {
    let wins = 0;
    for (let n = 0; n < 100_000; n++)
      if (exceptionalFatalityRoll(() => n / 2 ** 32)) wins++;
    expect(wins).toBe(1);
    expect(exceptionalFatalityRoll(() => 100_000 / 2 ** 32)).toBe(true);
    const draw = vi
      .fn()
      .mockReturnValueOnce((2 ** 32 - 1) / 2 ** 32)
      .mockReturnValueOnce(1 / 2 ** 32);
    expect(exceptionalFatalityRoll(draw)).toBe(false);
    expect(draw).toHaveBeenCalledTimes(2);
  });
  it("does not roll at home or in ordinary quiet places, and caps checks at one per eligible day", () => {
    roll(0.9);
    let s = world();
    expose(s, "south.towers", "linger");
    expect(s.danger.exposure.exceptionalDay).toBe(0);
    s = moveTo(s, "south.food-mart");
    expect(s.danger.exposure.exceptionalDay).toBe(0);
    s = moveTo(s, "nawf.deli");
    expect(s.danger.exposure.exceptionalDay).toBe(s.day);
    const after = s.rng;
    s = moveTo(s, "nawf.bodega");
    expect(s.rng).toBe(after); // same district free travel cannot roll again
    expect(
      s.danger.exposure.keys.filter((k) => k.startsWith("arrival:nawf")),
    ).toHaveLength(1);
    s = deserialize(serialize(s));
    expose(s, "nawf.deli", "activity", "2");
    const keys = [...s.danger.exposure.keys];
    expose(s, "nawf.deli", "activity", "2");
    expect(s.danger.exposure.keys).toEqual(keys);
    expect(s.danger.exposure.exceptionalDay).toBe(s.day);
    s.day++;
    expose(s, "nawf.deli", "linger");
    expect(s.danger.exposure.exceptionalDay).toBe(s.day);
  });
  it("camera projections and menu reopening do not consume RNG or exposure", () => {
    roll();
    const s = moveTo(world(), "nawf.deli");
    const snapshot = serialize(s);
    for (let n = 0; n < 10; n++) {
      deriveBoardView(s);
      assessRisk(s, "nawf.deli");
      presenceOf(s);
      syncEncounters(s);
    }
    expect(serialize(s)).toBe(snapshot);
  });
  it("enforces a four-check daily budget even for rapid activity commands", () => {
    roll(0.9);
    const s = world();
    for (let n = 0; n < 20; n++) expose(s, "nawf.deli", "activity", String(n));
    expect(s.danger.exposure.keys).toHaveLength(4);
  });
  it("a winning eligible exceptional draw immediately ends a civilian run; war does not use that draw", () => {
    roll(0);
    const next = moveTo(world(), "nawf.deli");
    expect(next.end).toBe("killed");
    expect(next.danger.conflicts).toHaveLength(0);
    expect(advanceDay(next)).toBe(next);
    expect(moveTo(next, "south.towers")).toBe(next);
    expect(
      performAction(next, { actor: next.playerId, type: "rest" }).error,
    ).toMatch(/ended/);
    expect(deserialize(serialize(next)).end).toBe("killed");
    const s = world("contact-muds");
    player(s).affiliation = "blips";
    expect(lethalConflict(s)).toBe(true);
    const warState = moveTo(s, "nawf.deli");
    expect(warState.danger.exposure.exceptionalDay).toBe(0);
  });
});

describe("hospital recovery and persistence", () => {
  it("advances the living city, costs, relationships, memories and missed obligations during recovery", () => {
    const s = newGame("Morgan", "south");
    const e = record(s, "risk", "Survived a shooting", [s.playerId]);
    hospitalize(s, "shooting", e.id);
    expect(player(s).status).toBe("laying-low");
    expect(s.ap).toBe(0);
    expect(hospitalStay(s)?.releaseDay).toBe(6);
    expect(player(s).wallet.clean).toBe(0);
    expect(s.street.arrears).toBe(355);
    expect(
      s.ledger.some(
        (l) => l.reason === "Hospital treatment" && l.amount === -125,
      ),
    ).toBe(true);
    expect(
      s.characters.flacco.memories.some((m) => m.meaning.includes("hospital")),
    ).toBe(true);
    expect(performAction(s, { actor: s.playerId, type: "gig" }).error).toMatch(
      /hospital/,
    );
    expect(moveTo(s, "nawf.deli")).toBe(s);
    const loaded = deserialize(serialize(s));
    const after = recoverInHospital(loaded);
    expect(after.day).toBe(6);
    expect(hospitalStay(after)).toBeUndefined();
    expect(player(after).status).toBe("active");
    expect(after.ap).toBe(2);
    expect(after.danger.injuries[0].discharged).toBe(true);
    expect(after.street.arrears).toBeGreaterThan(s.street.arrears);
    expect(after.characters["resident-downtown"].lastActionDay).toBe(6);
    expect(after.factions).not.toEqual(s.factions);
    expect(after.rng).not.toBe(s.rng);
    expect(deserialize(serialize(after))).toEqual(after);
  });
  it("misses real scheduled shifts while hospitalized instead of freezing employment", () => {
    let s = newGame("Morgan", "south");
    s = performAction(s, {
      actor: s.playerId,
      type: "apply",
      jobId: "retail-south",
    }).state;
    s = performAction(s, {
      actor: s.playerId,
      type: "acceptJob",
      jobId: "retail-south",
    }).state;
    expect(s.employment).toHaveLength(1);
    const e = record(s, "risk", "Survived serious violence", [s.playerId]);
    hospitalize(s, "shooting", e.id);
    s = recoverInHospital(s);
    expect(s.employment[0].attendance.some((a) => a.status === "missed")).toBe(
      true,
    );
    expect(s.employment[0].warnings).toBeGreaterThan(0);
    expect(deserialize(serialize(s)).employment).toEqual(s.employment);
  });
  it("board arrival interrupts the intended activity before money or AP can change", () => {
    roll();
    const s = world();
    const result = performActionAt(
      s,
      { actor: s.playerId, type: "buy", item: "booze" },
      "nawf.deli",
    );
    expect(result.error).toMatch(/encounter/);
    expect(result.state.presence?.location).toBe("nawf.deli");
    expect(result.state.ap).toBe(s.ap);
    expect(player(result.state).wallet).toEqual(player(s).wallet);
    expect(s.danger.scenes).toHaveLength(0);
  });
  it("accepts prior version-8 Lab saves with empty danger state, rejects damaged references", () => {
    const s = newGame("Morgan", "south");
    const raw = JSON.parse(serialize(s));
    delete raw.state.danger;
    expect(deserialize(JSON.stringify(raw)).danger.conflicts).toEqual([]);
    beef(s, "mega");
    s.danger.conflicts[0].originEvent = "missing-event";
    expect(() => deserialize(serialize(s))).toThrow(/danger/);
  });
  it("preserves a manual checkpoint before death and deterministic seed continuation", () => {
    let a = newGame("Morgan", "south", 987);
    a = moveTo(a, "nawf.deli");
    let b = deserialize(serialize(a));
    for (let i = 0; i < 8; i++) {
      a = advanceDay(a);
      b = advanceDay(b);
    }
    expect(a).toEqual(b);
    const manual = serialize(newGame("Morgan", "south"));
    expect(deserialize(manual).end).toBeNull();
  });
});
