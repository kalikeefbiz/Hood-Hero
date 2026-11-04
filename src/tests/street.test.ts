import { streetConversation } from "../systems/Danger";
import { describe, it, expect } from "vitest";
import { newGame } from "../core/Simulation";
import { advanceDay, serveSentence } from "../core/TimeSystem";
import { player, cash, type GameState, type ZoneId } from "../core/GameState";
import { performAction, validateAction } from "../core/ActionEngine";
import {
  acquire,
  repay,
  supplierError,
  transactionError,
  saleLot,
  marketAccess,
  lotProfit,
  transact,
} from "../systems/StreetEconomy";
import { openSupplier } from "../content/streetEncounters";
import { currentEncounter } from "../systems/EncounterLifecycle";
import { respondEncounter } from "../systems/Encounters";
import { exposureScore, addExposure } from "../systems/CriminalExposure";
import { arrest } from "../systems/Incarceration";
import { advancePressure } from "../systems/Reputation";
import { requestActivity, cooperation } from "../systems/CrewAgency";
import { serialize, deserialize } from "../persistence/SaveSystem";
function act(
  s: GameState,
  type: Parameters<typeof performAction>[1]["type"],
  target?: string,
) {
  if (streetConversation(s))
    s = respondEncounter(
      s,
      s.encounters.find((e) => e.dangerSceneId === streetConversation(s)!.id)!
        .id,
      "listen",
    ).state;
  const r = performAction(s, { actor: s.playerId, type, target });
  expect(r.error).toBeNull();
  return r.state;
}
function accept(s: GameState, arrangement = "consignment") {
  s = openSupplier(s, "mega");
  const e = currentEncounter(s)!;
  const r = respondEncounter(s, e.id, arrangement);
  expect(r.error).toBeNull();
  return r.state;
}
describe("complete inventory economy", () => {
  it("real new-game contact, supplier conversation, actual transactions and repayment; no injected money or goods", () => {
    let s = newGame("Test(6)", "south", 2026);
    s = act(s, "contact", "mega");
    s = openSupplier(s, "mega");
    let e = currentEncounter(s)!;
    s = respondEncounter(s, e.id, "terms").state;
    expect(currentEncounter(s)?.id).toBe(e.id);
    s = respondEncounter(s, e.id, "consignment").state;
    expect(currentEncounter(s)?.definitionId).not.toBe("street-supplier");
    expect(cash(player(s))).toBe(125);
    expect(saleLot(s)?.remaining).toBe(6);
    let attempts = 0;
    while (saleLot(s) && s.day < 7) {
      if (!s.ap) s = advanceDay(s);
      if (player(s).status !== "active") {
        s = serveSentence(s);
        continue;
      }
      if (transactionError(s)) {
        s = advanceDay(s);
        continue;
      }
      s = act(s, "crime");
      attempts++;
    }
    expect(attempts).toBeGreaterThan(1);
    const a = s.street.agreements[0],
      l = s.street.lots[0];
    expect(l.collected).toBe(
      s.street.transactions.reduce((n, t) => n + t.gross, 0),
    );
    expect(cash(player(s))).toBeGreaterThanOrEqual(a.balance);
    const before = cash(player(s));
    repay(s, a.id, 25);
    expect(a.balance).toBe(77);
    repay(s, a.id, a.balance);
    expect(a.status).toBe("fulfilled");
    expect(cash(player(s))).toBe(before - 102);
    expect(lotProfit(l)).toBe(l.collected - 102 - l.losses - l.crewPaid);
    const snapshot = serialize(s);
    repay(s, a.id, 25);
    expect(serialize(s)).toBe(snapshot);
    expect(deserialize(snapshot)).toEqual(s);
    s = advanceDay(s);
    expect(s.end).toBeNull();
    s = act(s, "gig");
    expect(s.ledger.at(-1)?.provenance).toBe("clean");
  });
  it("cash purchase transfers money without granting any resale proceeds", () => {
    let s = accept(newGame("Cash", "south"), "cash");
    expect(cash(player(s))).toBe(35);
    expect(s.street.agreements).toHaveLength(0);
    expect(s.street.lots[0].paid).toBe(90);
    expect(s.street.lots[0].collected).toBe(0);
    s = act(s, "crime");
    expect(s.street.transactions).toHaveLength(1);
    expect(s.ap).toBe(0);
  });
  it("loss never erases debt, default happens once, and late repayment repairs some trust without erasing the broken word", () => {
    let chosen: GameState | undefined;
    for (let seed = 1; seed < 100; seed++) {
      let s = accept(newGame("Loss", "south", seed * 98713));
      s = act(s, "crime");
      if (s.street.lots[0].lost) {
        chosen = s;
        break;
      }
    }
    expect(chosen).toBeDefined();
    let s = chosen!;
    const trust = s.characters.mega.relationships.player.trust;
    while (s.day <= s.street.agreements[0].dueDay) s = advanceDay(s);
    const a = s.street.agreements[0];
    expect(a.balance).toBe(102);
    expect(a.status).toBe("overdue");
    expect(s.characters.mega.relationships.player.trust).toBeLessThan(trust);
    expect(supplierError(s, "mega", "consignment")).toContain("balance");
    expect(s.commitments.find((c) => c.id === a.commitmentId)?.status).toBe(
      "broken",
    );
    expect(
      s.events.filter((e) => e.title === "Mega is still owed"),
    ).toHaveLength(1);
    // Existing lawful gig supplies actual money for repair.
    while (cash(player(s)) < 102) {
      if (!s.ap) s = advanceDay(s);
      s = act(s, "gig");
      if (cash(player(s)) < 102) s = advanceDay(s);
    }
    repay(s, a.id, 102);
    expect(s.street.agreements[0].balance).toBe(0);
    expect(s.street.agreements[0].status).toBe("fulfilled");
    expect(s.end).toBeNull();
    expect(s.commitments.find((c) => c.id === a.commitmentId)?.status).toBe(
      "broken",
    );
    expect(deserialize(serialize(s))).toEqual(s);
  });
  it.each(["downtown", "rio", "south", "reservoir", "nawf"] as ZoneId[])(
    "%s has distinct local access; distant friendship does not unlock every market",
    (home) => {
      let s = newGame("Home", home);
      const local = Object.values(s.characters).filter(
        (n) =>
          n.home === home &&
          n.affiliation &&
          n.status === "active" &&
          n.traits.lawful < 65,
      );
      if (home === "south") expect(marketAccess(s, "player", home)).toBeNull();
      else expect(marketAccess(s, "player", home)).not.toBeNull();
      if (local.length) {
        if (home === "rio") {
          s = act(s, "introduce", "resident-rio");
          s = act(s, "contact", "dizzy");
        } else s = act(s, "contact", local[0].id);
        expect(marketAccess(s, "player", home)).toBeNull();
      }
      expect(marketAccess(s, "player", "downtown")).not.toBeNull();
      expect(s.zones.downtown.police).toBeGreaterThan(s.zones.rio.police);
      expect(s.end).toBeNull();
    },
  );
  it("blocks old money shortcut, fabricated partners, duplicate goods and counterfeit saves", () => {
    let s = newGame("No exploit", "south");
    expect(validateAction(s, { actor: "player", type: "crime" })).toContain(
      "No merchandise",
    );
    s = accept(s);
    const snapshot = serialize(s);
    acquire(s, "mega", "consignment");
    expect(serialize(s)).toBe(snapshot);
    transact(s, "player", undefined, "justice");
    expect(serialize(s)).toBe(snapshot);
    const raw = JSON.parse(snapshot);
    raw.state.street.lots[0].remaining = 100;
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/street economy/);
    while (saleLot(s) && s.day < 12) {
      if (!s.ap || transactionError(s)) {
        s = advanceDay(s);
        continue;
      }
      s = act(s, "crime");
    }
    expect(s.street.lots[0].remaining).toBe(0);
    const count = s.street.transactions.length;
    expect(
      performAction(s, { type: "crime", actor: "player" }).error,
    ).not.toBeNull();
    expect(s.street.transactions.length).toBe(count);
  });
});
describe("exposure, custody and city continuity", () => {
  it("history survives harmless activity; repeated work raises risk gradually, without a fixed punishment count", () => {
    let s = newGame("History", "south");
    addExposure(s, "player", "south");
    const score = exposureScore(s, "player", "south");
    s = act(s, "rest");
    expect(exposureScore(s, "player", "south")).toBe(score);
    const x = s.street.exposure.player;
    expect(x.recent).toHaveLength(1);
    for (let i = 0; i < 5; i++) addExposure(s, "player", "south");
    expect(exposureScore(s, "player", "south")).toBeGreaterThan(score);
    s = advanceDay(s);
    expect(s.street.exposure.player.recent.length).toBeGreaterThan(0);
    const outcomes = new Set<string>();
    for (let seed = 1; seed < 100; seed++) {
      const t = newGame("Chance", "south", seed * 98713);
      for (let i = 0; i < 12; i++) addExposure(t, "player", "south", 18);
      advancePressure(t);
      outcomes.add(player(t).status);
    }
    expect(outcomes).toContain("active");
    expect(outcomes).toContain("arrested");
  });
  it("temporary arrest preserves campaign, simulates every day, costs money and keeps obligations and Loco intact", () => {
    let s = accept(newGame("Custody", "south"));
    const before = cash(player(s)),
      day = s.day;
    arrest(s, "player", "seeded ordinary offense", 1);
    const release = s.street.custody.at(-1)!.releaseDay!;
    expect(s.end).toBeNull();
    expect(validateAction(s, { actor: "player", type: "gig" })).toContain(
      "not active",
    );
    s = deserialize(serialize(s));
    s = serveSentence(s);
    expect(s.day).toBe(release);
    expect(player(s).status).toBe("active");
    expect(cash(player(s))).toBe(Math.max(0, before - (release - day) * 18));
    expect(s.characters.loco.status).toBe("arrested");
    expect(s.street.custody[0].releaseDay).toBeNull();
    expect(s.street.agreements[0].balance).toBe(102);
    expect(player(s).police).toBeGreaterThan(0);
    expect(s.events.some((e) => e.title === "Custody released")).toBe(true);
    expect(s.characters.flacco.lastActionDay).toBeGreaterThan(day);
    s = act(s, "gig");
    expect(s.end).toBeNull();
    arrest(s, "player", "second offense", 2);
    s = serveSentence(s);
    arrest(s, "player", "third offense", 2);
    s = serveSentence(s);
    expect(s.characters.loco.status).toBe("arrested");
    expect(cash(player(s))).toBeGreaterThanOrEqual(0);
    expect(s.street.arrears).toBeGreaterThan(0);
    expect(s.street.agreements[0].status).toBe("overdue");
  });
  it("crew refuses or participates through existing cooperation and inventory, with actual shared pay and participant exposure only", () => {
    let s = accept(newGame("Crew", "south", 123456));
    expect(cooperation(s, s.characters.flacco, "partner-crime").accepted).toBe(
      false,
    );
    requestActivity(s, "flacco", "partner-crime");
    expect(s.assignments.at(-1)?.status).toBe("refused");
    // Gain willingness through actual friendship, no altered character values.
    for (
      let i = 0;
      i < 8 && !cooperation(s, s.characters.flacco, "partner-crime").accepted;
      i++
    ) {
      s = advanceDay(s);
      s = act(s, "contact", "flacco");
    }
    if (!s.ap) s = advanceDay(s);
    expect(cooperation(s, s.characters.flacco, "partner-crime").accepted).toBe(
      true,
    );
    const megaPolice = s.characters.mega.police;
    const before = cash(s.characters.flacco);
    requestActivity(s, "flacco", "partner-crime");
    expect(s.assignments.at(-1)?.status).toBe("resolved");
    expect(s.street.transactions.at(-1)?.partner).toBe("flacco");
    expect(cash(s.characters.flacco)).toBe(
      before +
        s.street.transactions.at(-1)!.crewPaid -
        s.street.transactions.at(-1)!.crewLoss,
    );
    expect(s.characters.flacco.police).toBeGreaterThan(0);
    expect(s.characters.mega.police).toBe(megaPolice);
    expect(deserialize(serialize(s))).toEqual(s);
  });
});

describe("world and obligation boundaries", () => {
  it("custody misses real scheduled shifts, can lose employment, and keeps supplier debt", () => {
    let s = newGame("Absent", "south");
    for (const type of ["apply", "acceptJob"] as const) {
      const r = performAction(s, {
        actor: "player",
        type,
        jobId: "retail-south",
      });
      expect(r.error).toBeNull();
      s = r.state;
    }
    s = advanceDay(s);
    s = accept(s);
    arrest(s, "player", "seeded serious exposure", 6);
    s = serveSentence(s);
    expect(
      s.employment[0].attendance.filter((a) => a.status === "missed").length,
    ).toBeGreaterThanOrEqual(3);
    expect(s.employment[0].status).toBe("terminated");
    expect(s.street.agreements[0].balance).toBe(102);
    expect(s.street.agreements[0].status).toBe("overdue");
    expect(player(s).status).toBe("active");
    expect(s.end).toBeNull();
  });
  it("temporary NPC custody interrupts availability and releases that member without releasing Loco", () => {
    let s = newGame("Member", "south");
    arrest(s, "flacco", "participant exposure");
    expect(cooperation(s, s.characters.flacco, "partner-crime").accepted).toBe(
      false,
    );
    const release = s.street.custody.at(-1)!.releaseDay!;
    while (s.day < release) s = advanceDay(s);
    expect(s.characters.flacco.status).toBe("active");
    expect(s.characters.loco.status).toBe("arrested");
    expect(s.street.custody.find((r) => r.character === "flacco")?.status).toBe(
      "released",
    );
  });
  it("autonomous local actors change markets without claiming territory or disclosing unknown contacts", () => {
    let s = newGame("Markets", "downtown");
    const controllers = Object.values(s.zones).map((z) => z.controller);
    for (let i = 0; i < 30; i++) s = advanceDay(s);
    expect(s.street.markets.rio.activity).toBeGreaterThan(0);
    expect(s.street.markets.nawf.factions.blips).toBeGreaterThan(0);
    expect(Object.values(s.zones).map((z) => z.controller)).toEqual(
      controllers,
    );
    expect(Object.keys(s.factions)).toHaveLength(5);
    expect(
      s.events
        .filter((e) => e.title === "Local market shifted")
        .every((e) => player(s).known.includes(e.actors[0])),
    ).toBe(true);
  });
});
