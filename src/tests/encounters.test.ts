import { describe, expect, it } from "vitest";
import { newGame } from "../core/Simulation";
import { advanceDay } from "../core/TimeSystem";
import {
  performAction,
  availableActions,
  type ActionType,
} from "../core/ActionEngine";
import { cash, player, type GameState, type ZoneId } from "../core/GameState";
import { acknowledgeEvent, record, unseenEvents } from "../core/EventLog";
import {
  currentEncounter,
  dismissEncounter,
  openEncounter,
  respondEncounter,
  syncEncounters,
} from "../systems/Encounters";
import {
  incidentDueDay,
  incidentPromise,
  evaluatePromises,
} from "../systems/Commitments";
import { resolveIncident } from "../systems/Incidents";
import { deserialize, serialize } from "../persistence/SaveSystem";
import { CHARACTER_ART, characterArt, artURL } from "../ui/characterArt";
import manifest from "../../docs/design/CHARACTER_ART_MANIFEST.json";
import { megaDialogue } from "../content/encounters";
const fresh = (seed = 2026, zone: ZoneId = "south") =>
  newGame("Test(3)", zone, seed);
const intro = (s: GameState) =>
  s.encounters.find((e) => e.definitionId === "mega-chains-request")!;
function answer(s: GameState, response: string) {
  if (["buyback", "recover", "settlement", "negotiate"].includes(response))
    return act(
      s,
      response as ActionType,
      response === "settlement" ? "pablo" : undefined,
    );
  const r = respondEncounter(s, intro(s).id, response);
  expect(r.error).toBeNull();
  return r.state;
}
function act(s: GameState, type: ActionType, target?: string) {
  const r = performAction(s, {
    type,
    target,
    actor: s.playerId,
    incidentId: "the-chains",
  });
  expect(r.error).toBeNull();
  return r.state;
}
function buyback() {
  let s = answer(fresh(), "promise");
  s = act(s, "gig");
  return answer(s, "buyback");
}
describe("character-driven Chains playthroughs", () => {
  it.each(["downtown", "rio", "south", "reservoir", "nawf"] as ZoneId[])(
    "A: promise, real buyback, reaction, and continued work from %s",
    (zone) => {
      let s = fresh(2026, zone);
      expect(currentEncounter(s)?.definitionId).toBe("mega-chains-request");
      const before = structuredClone(s.characters.mega.relationships.player);
      s = answer(s, "promise");
      expect(s.ap).toBe(2);
      expect(cash(player(s))).toBe(125);
      expect(s.characters.mega.relationships.player).toEqual(
        expect.objectContaining({
          trust: before.trust,
          respect: before.respect,
        }),
      );
      expect(incidentPromise(s, "the-chains")?.dueDay).toBe(9);
      s = act(s, "gig");
      s = answer(s, "buyback");
      const promise = incidentPromise(s, "the-chains")!;
      expect(promise.status).toBe("fulfilled");
      expect(promise.evidence.length).toBeGreaterThan(0);
      expect(s.ap).toBe(0);
      expect(cash(player(s))).toBe(13);
      expect(s.properties.chains.possession).toEqual({
        kind: "character",
        id: "mega",
      });
      expect(
        s.characters.mega.memories.some((m) =>
          m.meaning.includes("Kept the promise"),
        ),
      ).toBe(true);
      expect(unseenEvents(s).some((e) => e.commitmentId === promise.id)).toBe(
        true,
      );
      expect(characterArt(s, "mega")?.path).toContain("confident-with-chain");
      expect(megaDialogue(s, currentEncounter(s)!)).toContain("came through");
      expect(
        availableActions(s).filter((a) =>
          ["buyback", "recover", "negotiate", "settlement", "favor"].includes(
            a.type,
          ),
        ),
      ).toHaveLength(0);
      const beforeReplay = serialize(s);
      resolveIncident(s, s.incidents["the-chains"], "buyback", "player");
      evaluatePromises(s);
      expect(serialize(s)).toBe(beforeReplay);
      s = act(advanceDay(s), "gig");
      expect(s.end).toBeNull();
    },
  );
  it("uses real recovery odds and exposure; a failed attempt never earns settlement credit", () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      let s = answer(fresh(seed), "promise");
      s = answer(s, "recover");
      expect(s.ap).toBe(0);
      expect(cash(player(s))).toBe(125);
      expect(player(s).police).toBeGreaterThan(0);
      const recovered = s.incidents["the-chains"].resolution === "recovered";
      outcomes.add(recovered ? "success" : "failure");
      expect(incidentPromise(s, "the-chains")?.status).toBe(
        recovered ? "fulfilled" : "pending",
      );
      if (!recovered) {
        expect(s.incidents["the-chains"].interventions[0].type).toBe(
          "failed-recovery",
        );
        resolveIncident(s, s.incidents["the-chains"], "settlement", "pablo");
        evaluatePromises(s);
        expect(incidentPromise(s, "the-chains")?.status).toBe("superseded");
      }
    }
    expect([...outcomes].sort()).toEqual(["failure", "success"]);
  });
  it("B: deadline loss breaks a neglected promise with bounded relationship consequences and a warning", () => {
    // Seed 13 has no successful autonomous settlement before the sale.
    let s = answer(fresh(13), "promise");
    while (s.day < 9) s = advanceDay(s);
    expect(s.incidents["the-chains"].resolution).toBe("sold");
    expect(incidentPromise(s, "the-chains")?.status).toBe("broken");
    expect(
      unseenEvents(s).some((e) => e.title === "You left Cuzzo hanging"),
    ).toBe(true);
    expect(
      s.events.filter((e) => e.title === "Cuzzo is counting on you"),
    ).toHaveLength(1);
    expect(
      s.characters.mega.memories.some((m) =>
        m.meaning.includes("left me hanging"),
      ),
    ).toBe(true);
    expect(s.characters.mega.relationships.player.grievance).toBe(14);
    expect(characterArt(s, "mega", "concerned")?.path).toContain("no-chain");
    expect(act(s, "gig").end).toBeNull();
  });
  it("evaluates a final-day autonomous settlement before expiring the promise", () => {
    let s = answer(fresh(1), "promise");
    while (s.day < 9) s = advanceDay(s);
    expect(s.incidents["the-chains"].resolution).toBe("settlement");
    expect(
      s.events.find((e) => e.id === s.incidents["the-chains"].resolvedEventId)
        ?.day,
    ).toBe(9);
    expect(incidentPromise(s, "the-chains")?.status).toBe("superseded");
    expect(s.events.some((e) => e.title === "You left Cuzzo hanging")).toBe(
      false,
    );
  });
  it("C: refusal is persistent, carries no betrayal penalty and does not stop autonomous progression", () => {
    let s = fresh(1);
    const r = structuredClone(s.characters.mega.relationships.player);
    s = answer(s, "decline");
    expect(s.commitments).toHaveLength(0);
    expect(intro(s).selectedResponses[0].id).toBe("decline");
    expect(s.characters.mega.relationships.player).toEqual(r);
    expect(megaDialogue(s, intro(s))).toContain("I heard you");
    while (s.day < 10) s = advanceDay(s);
    expect(s.incidents["the-chains"].status).not.toBe("active");
    expect(s.events.some((e) => e.title === "You left Cuzzo hanging")).toBe(
      false,
    );
  });
  it("D: a player-prompted leadership settlement fulfills; independent settlement supersedes without credit", () => {
    let prompted = answer(fresh(20), "promise");
    prompted = answer(prompted, "settlement");
    while (prompted.incidents["the-chains"].status === "active")
      prompted = advanceDay(prompted);
    expect(prompted.incidents["the-chains"].resolution).toBe("settlement");
    expect(incidentPromise(prompted, "the-chains")?.status).toBe("fulfilled");
    expect(prompted.incidents["the-chains"].resolvedBy).toBe("pablo");
    let independent = answer(fresh(), "promise");
    const influence = player(independent).influence,
      trust = independent.characters.mega.relationships.player.trust;
    resolveIncident(
      independent,
      independent.incidents["the-chains"],
      "settlement",
      "pablo",
    );
    evaluatePromises(independent);
    syncEncounters(independent);
    expect(incidentPromise(independent, "the-chains")?.status).toBe(
      "superseded",
    );
    expect(player(independent).influence).toBe(influence);
    expect(independent.characters.mega.relationships.player.trust).toBe(trust);
    expect(independent.properties.chains.possession.id).toBe("mega");
    expect(megaDialogue(independent, currentEncounter(independent)!)).toContain(
      "Pablo handled it",
    );
  });
  it("E: save/resume preserves choices, deadlines, RNG, evidence and acknowledgment without farming", () => {
    let s = answer(fresh(), "promise");
    s = deserialize(serialize(s));
    expect(incidentPromise(s, "the-chains")?.dueDay).toBe(
      incidentDueDay(s.incidents["the-chains"]),
    );
    expect(respondEncounter(s, intro(s).id, "promise").error).not.toBeNull();
    s = act(s, "gig");
    s = answer(s, "buyback");
    const pendingNotices = unseenEvents(s).map((e) => e.id);
    s = deserialize(serialize(s));
    syncEncounters(s);
    expect(unseenEvents(s).map((e) => e.id)).toEqual(pendingNotices);
    for (const e of unseenEvents(s)) s = acknowledgeEvent(s, e.id);
    s = deserialize(serialize(s));
    syncEncounters(s);
    expect(unseenEvents(s)).toHaveLength(0);
    expect(currentEncounter(s)).toBeUndefined();
    const t = s.characters.mega.relationships.player.trust,
      rng = s.rng;
    for (const e of s.encounters.filter(
      (e) => e.definitionId === "chains-reaction",
    )) {
      s = openEncounter(s, e.id);
      s = dismissEncounter(s, e.id);
    }
    expect(s.characters.mega.relationships.player.trust).toBe(t);
    expect(s.rng).toBe(rng);
    expect(advanceDay(deserialize(serialize(s)))).toEqual(advanceDay(s));
  });
});
describe("encounter boundaries and art", () => {
  it("rejects gameplay responses without AP or cash and leaves input and RNG untouched", () => {
    const s = answer(fresh(), "promise");
    const raw = serialize(s);
    expect(
      performAction(s, {
        type: "buyback",
        actor: s.playerId,
        incidentId: "the-chains",
      }).error,
    ).toMatch(/cash/);
    expect(serialize(s)).toBe(raw);
    s.ap = 0;
    expect(
      performAction(s, {
        type: "recover",
        actor: s.playerId,
        incidentId: "the-chains",
      }).error,
    ).toMatch(/AP/);
    expect(
      performAction(s, {
        type: "negotiate",
        actor: s.playerId,
        incidentId: "the-chains",
      }).error,
    ).toMatch(/AP/);
  });
  it("normalizes incident age to an absolute due day and uses current demand in dialogue", () => {
    let s = fresh();
    s.day = 12;
    s.incidents["the-chains"].startedDay = 12;
    s.incidents["the-chains"].demand = 165;
    expect(megaDialogue(s, intro(s))).toContain("$165");
    s = answer(s, "promise");
    expect(incidentPromise(s, "the-chains")?.dueDay).toBe(20);
  });
  it("dismissal and delay create no obligation and do not freeze the deadline", () => {
    let s = fresh();
    const rng = s.rng;
    s = dismissEncounter(s, intro(s).id);
    expect(s.commitments).toHaveLength(0);
    expect(intro(s).selectedResponses).toHaveLength(0);
    s = openEncounter(s, intro(s).id);
    s = answer(s, "delay");
    s = advanceDay(s);
    expect(intro(s).status).toBe("pending");
    expect(currentEncounter(s)).toBeUndefined();
    s = openEncounter(s, intro(s).id);
    s = answer(s, "delay");
    const due = intro(s).dueDay;
    while (s.day < 10) s = advanceDay(s);
    expect(intro(s).dueDay).toBe(due);
    expect(intro(s).status).toBe("closed");
    expect(s.commitments).toHaveLength(0);
    expect(rng).toBe(2026);
  });
  it("unobserved major events never create notifications, encounters or acknowledgments", () => {
    let s = fresh();
    const e = record(
      s,
      "incident",
      "Secret leadership discussion",
      ["pablo"],
      ["pablo"],
      { importance: "major", incidentId: "the-chains" },
    );
    syncEncounters(s);
    expect(unseenEvents(s)).toHaveLength(0);
    expect(s.encounters.some((x) => x.sourceEventId === e.id)).toBe(false);
    expect(acknowledgeEvent(s, e.id)).toBe(s);
  });
  it("F: all approved registry files match manifest and possession always gates Mega’s jewelry", () => {
    const s = fresh();
    for (const expression of [
      "concerned",
      "confident",
      "proposing",
      "strategizing",
    ] as const)
      expect(characterArt(s, "mega", expression)?.path).toContain("no-chain");
    for (const id of ["babycanon", "joker", "dizzy"])
      expect(characterArt(s, id)?.path).toContain(
        id === "babycanon" ? "baby-canon" : id,
      );
    for (const id of ["flacco", "pablo", "justice", "loco", "player"])
      expect(characterArt(s, id)).toBeNull();
    for (const illustration of Object.values(CHARACTER_ART.mega))
      expect(
        manifest.assets.some(
          (a) => a.runtime.path === `public/${illustration.path}`,
        ),
      ).toBe(true);
    expect(artURL("assets/characters/mega/test.webp", "/Hood-Hero/")).toBe(
      "/Hood-Hero/assets/characters/mega/test.webp",
    );
    const returned = buyback();
    expect(characterArt(returned, "mega", "strategizing")?.path).toContain(
      "strategizing-with-chain",
    );
  });
});

describe("correction: conversations conclude independently of storylines", () => {
  it("acceptance closes the conversation while the obligation and incident continue", () => {
    const s = answer(fresh(), "promise");
    expect(currentEncounter(s)).toBeUndefined();
    expect(intro(s).status).toBe("acknowledged");
    expect(incidentPromise(s, "the-chains")?.status).toBe("pending");
    expect(s.incidents["the-chains"].status).toBe("active");
    expect(openEncounter(s, intro(s).id)).toBe(s);
  });
  it.each(["fulfilled", "broken"])(
    "does not reopen a %s story over 40 further days, including reload",
    (outcome) => {
      let s =
        outcome === "fulfilled" ? buyback() : answer(fresh(13), "promise");
      while (s.incidents["the-chains"].status === "active") s = advanceDay(s);
      expect(incidentPromise(s, "the-chains")?.status).toBe(outcome);
      expect(
        unseenEvents(s).filter((e) => e.incidentId === "the-chains"),
      ).toHaveLength(1);
      const reaction = s.encounters.find(
        (e) =>
          e.sourceEventId ===
          unseenEvents(s).find((e) => e.incidentId === "the-chains")!.id,
      )!;
      s = openEncounter(s, reaction.id);
      s = respondEncounter(s, reaction.id, "acknowledge").state;
      const recorded = s.encounters.filter(
        (e) => !e.definitionId.startsWith("crew-"),
      ).length;
      for (let day = 0; day < 40; day++) {
        s = act(advanceDay(s), "gig");
        s = deserialize(serialize(s));
        expect(currentEncounter(s)?.incidentId).not.toBe("the-chains");
        expect(
          unseenEvents(s).filter((e) => e.incidentId === "the-chains"),
        ).toHaveLength(0);
      }
      expect(
        s.encounters.filter((e) => !e.definitionId.startsWith("crew-")).length,
      ).toBe(recorded);
      expect(
        s.characters.mega.memories.some((m) =>
          m.meaning.includes(
            outcome === "fulfilled" ? "Kept the promise" : "left me hanging",
          ),
        ),
      ).toBe(true);
      expect(s.characters.mega.status).toBe("active");
    },
  );
  it("queues independent simultaneous events, allows deferral, and acknowledges one outcome once", () => {
    let s = answer(fresh(), "decline");
    const first = record(
      s,
      "incident",
      "Leadership heard the request",
      ["pablo"],
      ["player"],
      {
        importance: "major",
        incidentId: "the-chains",
        presentationKey: "leadership",
      },
    );
    const second = record(
      s,
      "incident",
      "Deadline approaching",
      ["mega"],
      ["player"],
      {
        importance: "major",
        incidentId: "the-chains",
        presentationKey: "deadline",
      },
    );
    syncEncounters(s);
    expect(s.encounters.filter((e) => e.status === "active")).toHaveLength(1);
    expect(currentEncounter(s)?.sourceEventId).toBe(first.id);
    s = dismissEncounter(s, currentEncounter(s)!.id);
    expect(currentEncounter(s)?.sourceEventId).toBe(second.id);
    s = respondEncounter(s, currentEncounter(s)!.id, "acknowledge").state;
    expect(currentEncounter(s)).toBeUndefined();
    s = openEncounter(
      s,
      s.encounters.find((e) => e.sourceEventId === first.id)!.id,
    );
    s = respondEncounter(s, currentEncounter(s)!.id, "acknowledge").state;
    syncEncounters(s);
    expect(currentEncounter(s)).toBeUndefined();
  });
});
