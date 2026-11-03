import { describe, it, expect } from "vitest";
import { newGame } from "../core/Simulation";
import { performAction, validateAction } from "../core/ActionEngine";
import { advanceDay } from "../core/TimeSystem";
import { player, type GameState, type ZoneId } from "../core/GameState";
import { contactError, accessStatus, connect } from "../systems/Relationships";
import { openSupplier } from "../content/streetEncounters";
import { openStoryline, currentEncounter } from "../systems/EncounterLifecycle";
import { respondEncounter } from "../systems/Encounters";
import {
  acquire,
  transactionChance,
  transactionError,
  saleLot,
} from "../systems/StreetEconomy";
import {
  addExposure,
  transactionArrestChance,
  exposureScore,
} from "../systems/CriminalExposure";
import { serialize, deserialize } from "../persistence/SaveSystem";
function action(
  s: GameState,
  type: Parameters<typeof performAction>[1]["type"],
  target?: string,
) {
  const r = performAction(s, { type, target, actor: "player" });
  expect(r.error).toBeNull();
  return r.state;
}
describe("006.1 believable access and limited story access", () => {
  it.each(["downtown", "rio", "south", "reservoir", "nawf"] as ZoneId[])(
    "%s starts with friends and public local employment, not every criminal phone number",
    (home) => {
      let s = newGame("Access", home);
      expect(contactError(s, "player", "mega")).toBeNull();
      expect(contactError(s, "player", "flacco")).toBeNull();
      for (const id of ["dizzy", "babycanon", "joker", "pablo"]) {
        expect(accessStatus(s, "player", id)).toBe("Known of");
        expect(
          validateAction(s, { type: "contact", actor: "player", target: id }),
        ).toContain("not connected");
        expect(openSupplier(s, id)).toBe(s);
      }
      s = action(s, "contact", "mega");
      acquire(s, "mega", "consignment");
      expect(saleLot(s)?.remaining).toBe(6);
      expect(deserialize(serialize(s))).toEqual(s);
    },
  );
  it("information grants awareness; actual introduction grants access and respects rank", () => {
    let s = newGame("Introductions", "rio");
    s = action(s, "inquire", "resident-rio");
    expect(player(s).connections).not.toContain("dizzy");
    s = action(s, "introduce", "resident-rio");
    expect(player(s).connections).toContain("dizzy");
    expect(player(s).connections).not.toContain("pablo");
    s = advanceDay(s);
    s = action(s, "contact", "dizzy");
    s = action(s, "contact", "dizzy");
    s = advanceDay(s);
    expect(
      s.characters.dizzy.relationships.player.trust,
    ).toBeGreaterThanOrEqual(35);
    s = action(s, "introduce", "dizzy");
    expect(player(s).connections).toContain("pablo");
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it("Chains leadership interaction is available for its incident and never grants permanent access", () => {
    let s = newGame("Story", "south");
    s = openStoryline(s, "the-chains");
    let e = currentEncounter(s)!;
    s = respondEncounter(s, e.id, "clarify").state;
    s = respondEncounter(s, e.id, "promise").state;
    s = openStoryline(s, "the-chains");
    e = currentEncounter(s)!;
    const r = respondEncounter(s, e.id, "settlement");
    expect(r.error).toBeNull();
    s = r.state;
    expect(s.incidents["the-chains"].leadershipAware).toBe(true);
    expect(player(s).connections).not.toContain("pablo");
    expect(
      validateAction(s, {
        type: "socialize",
        actor: "player",
        target: "pablo",
      }),
    ).not.toBeNull();
    while (s.incidents["the-chains"].status === "active") s = advanceDay(s);
    expect(openStoryline(s, "the-chains")).toBe(s);
  });
  it("hostile contacts and unheard suppliers cannot bypass reach-out eligibility", () => {
    const s = newGame("Hostile", "south");
    connect(s, "player", "dizzy");
    s.characters.dizzy.relationships.player.grievance = 70;
    expect(
      validateAction(s, {
        type: "socialize",
        actor: "player",
        target: "dizzy",
      }),
    ).not.toBeNull();
    expect(openSupplier(s, "resident-south")).toBe(s);
    const raw = JSON.parse(serialize(s));
    raw.state.characters.player.connections.push("missing");
    expect(() => deserialize(JSON.stringify(raw))).toThrow();
  });
});
describe("006.1 routine, accumulated and significant exposure", () => {
  it("ordinary low-Heat trade has real baseline sale and police risk without a large Heat spike", () => {
    const s = newGame("Risk", "south", 2026);
    acquire(s, "mega", "consignment");
    expect(transactionChance(s)).toBeLessThan(1);
    expect(transactionChance(s)).toBeGreaterThan(0.65);
    expect(transactionArrestChance(s, "player", "south")).toBeGreaterThan(0);
    const r = performAction(s, { type: "crime", actor: "player" });
    expect(r.error).toBeNull();
    expect(player(r.state).police).toBeLessThan(12);
    expect(r.state.street.exposure.player.investigation).toBe(0);
  });
  it("major exposure creates investigation pressure and harmless actions cannot erase history", () => {
    let s = newGame("Pressure", "south");
    addExposure(s, "player", "south");
    expect(s.street.exposure.player.investigation).toBe(0);
    const risk = exposureScore(s, "player", "south");
    s = action(s, "rest");
    expect(exposureScore(s, "player", "south")).toBe(risk);
    addExposure(s, "player", "south", 18);
    expect(s.street.exposure.player.investigation).toBeGreaterThan(0);
    expect(exposureScore(s, "player", "south")).toBeGreaterThan(risk);
  });
  it("low-scrutiny arrest is possible, but never fixed by action count", () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 700; seed++) {
      const s = newGame("Baseline risk", "south", seed * 98713);
      acquire(s, "mega", "consignment");
      const r = performAction(s, { type: "crime", actor: "player" });
      expect(r.error).toBeNull();
      outcomes.add(player(r.state).status);
    }
    expect(outcomes).toContain("active");
    expect(outcomes).toContain("arrested");
  });
});
