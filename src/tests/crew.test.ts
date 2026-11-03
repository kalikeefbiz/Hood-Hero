import { acquire } from "../systems/StreetEconomy";
import { describe, expect, it } from "vitest";
import { newGame } from "../core/Simulation";
import { advanceDay } from "../core/TimeSystem";
import { cash, player, type GameState } from "../core/GameState";
import { performAction, actionSuccessChance } from "../core/ActionEngine";
import {
  openCrewConversation,
  currentEncounter,
  syncEncounters,
} from "../systems/EncounterLifecycle";
import { respondEncounter } from "../systems/Encounters";
import {
  acceptCrewOffer,
  assignmentChance,
  attendCrewActivity,
  attendError,
  availability,
  cooperation,
  CREW_BALANCE,
  processCrewActivities,
  requestActivity,
  requestError,
} from "../systems/CrewAgency";
import { serialize, deserialize } from "../persistence/SaveSystem";
import { acceptJob, applyForJob, generateShifts } from "../systems/Employment";
const fresh = (seed = 2026) => newGame("Test(5)", "south", seed);
function action(
  s: GameState,
  type: Parameters<typeof performAction>[1]["type"],
  target?: string,
  jobId?: string,
) {
  const r = performAction(s, { actor: s.playerId, type, target, jobId });
  expect(r.error).toBeNull();
  return r.state;
}
function speak(s: GameState, member: string, response: string) {
  s = openCrewConversation(s, member);
  const e = currentEncounter(s)!;
  const r = respondEncounter(s, e.id, response);
  expect(r.error).toBeNull();
  return r.state;
}
function recruitNaturally(seed = 2026, member = "resident-south") {
  let s = fresh(seed);
  // Reach out through a known contact when necessary; capacity and trust are earned using AP.
  if (!player(s).known.includes(member)) s = action(s, "inquire", "flacco");
  while (
    (s.characters[member].relationships.player?.trust ?? 0) < 42 ||
    s.crew.capacity < 2
  ) {
    if (s.ap === 0) s = advanceDay(s);
    s = action(s, "socialize", member);
  }
  if (!s.ap) s = advanceDay(s);
  s = action(s, "recruit", member);
  return s;
}
describe("personal Set agency", () => {
  it("uses the existing encounter and commitment engines for accepted work and persistent outcomes", () => {
    let s = speak(fresh(), "flacco", "work");
    expect(currentEncounter(s)?.definitionId).not.toBe("crew-conversation");
    expect(s.ap).toBe(1);
    expect(cash(player(s))).toBe(113);
    expect(s.assignments[0].status).toBe("active");
    expect(s.commitments[0].kind).toBe("crew-activity");
    expect(s.assignments[0].eventIds.length).toBe(1);
    s = advanceDay(deserialize(serialize(s)));
    expect(s.assignments[0].status).toBe("resolved");
    expect(
      s.characters.flacco.memories.some((m) =>
        m.meaning.includes("Paid local work"),
      ),
    ).toBe(true);
    const settled = serialize(s);
    processCrewActivities(s);
    expect(serialize(s)).toBe(settled);
    s = advanceDay(s);
    expect(s.characters.flacco.lastActionDay).toBe(s.day);
  });
  it("gives comprehensible state-based refusal without automatically ending friendship", () => {
    const s = fresh(),
      c = s.characters.flacco;
    const trust = c.relationships.player.trust;
    c.stress = 80;
    const before = cash(player(s));
    requestActivity(s, c.id, "work");
    expect(s.assignments[0].status).toBe("refused");
    expect(s.assignments[0].outcome).toContain("stretched too thin");
    expect(s.ap).toBe(2);
    expect(cash(player(s))).toBe(before);
    expect(c.relationships.player.trust).toBe(trust);
    expect(s.crew.members).toContain(c.id);
    c.stress = 10;
    expect(cooperation(s, c, "social").accepted).toBe(true);
  });
  it("negotiates compensation and preserves funds until a real outcome", () => {
    let s = fresh();
    s.characters.flacco.wallet.clean = 10;
    expect(cooperation(s, s.characters.flacco, "work").negotiate).toBe(true);
    s = speak(s, "flacco", "work-negotiated");
    expect(cash(player(s))).toBe(107);
    expect(s.characters.flacco.wallet.clean).toBe(10);
    s = advanceDay(s);
    expect(s.characters.flacco.wallet.clean).toBe(28);
  });
  it("natural second recruitment changes capabilities and lawful earnings", () => {
    let s = recruitNaturally();
    expect(s.crew.capacity).toBeGreaterThanOrEqual(2);
    expect(player(s).influence).toBeGreaterThanOrEqual(5);
    expect(s.crew.members).toContain("resident-south");
    expect(s.characters["resident-south"].skills.work).toBeGreaterThan(
      s.characters.flacco.skills.work,
    );
    if (!s.ap) s = advanceDay(s);
    // Both have the same trust and stress here only to isolate ability, after natural recruitment.
    const a = s.characters.flacco,
      b = s.characters["resident-south"];
    b.relationships.player = structuredClone(a.relationships.player);
    b.stress = a.stress;
    expect(assignmentChance(s, b, "work")).toBeGreaterThan(
      assignmentChance(s, a, "work"),
    );
    const f = structuredClone(s),
      r = structuredClone(s);
    f.characters.flacco.agency.lastAssignmentDay = 0;
    r.characters[b.id].agency.lastAssignmentDay = 0;
    requestActivity(f, a.id, "partner-gig");
    requestActivity(r, b.id, "partner-gig");
    expect(cash(player(r))).toBeGreaterThan(cash(player(f)));
  });
  it("uses goals, skill, trust, stress, risk values and real conflicting affiliation", () => {
    const s = fresh(),
      c = s.characters.flacco;
    expect(cooperation(s, c, "work").accepted).toBe(true);
    c.relationships.player.trust = 15;
    expect(cooperation(s, c, "work").reason).toContain("rebuild trust");
    c.relationships.player.trust = 80;
    c.traits.risk = 80;
    c.traits.lawful = 10;
    c.skills.recovery = 70;
    expect(cooperation(s, c, "partner-crime").accepted).toBe(true);
    const strong = actionSuccessChance(s, {
      actor: "player",
      type: "crime",
      partner: c.id,
    })!;
    c.skills.recovery = 10;
    c.stress = 60;
    expect(
      actionSuccessChance(s, { actor: "player", type: "crime", partner: c.id }),
    ).toBeLessThan(strong);
    c.affiliation = "angels";
    player(s).affiliation = "blocks";
    expect(cooperation(s, c, "partner-crime").reason).toContain("own people");
    player(s).affiliation = null;
    c.traits.lawful = 80;
    expect(cooperation(s, c, "partner-crime").accepted).toBe(false);
  });
  it("makes information incomplete and strictly bounded to the member's contacts", () => {
    const s = fresh();
    s.rng = 1;
    const c = s.characters.flacco;
    const known = [...player(s).known];
    c.known = [];
    c.skills.social = 85;
    requestActivity(s, c.id, "information");
    expect(player(s).known).toEqual(known);
    expect(s.incidents["the-chains"].informed).toBe(false);
    expect(s.assignments[0].outcome).toMatch(/Nothing new|couldn't confirm/);
  });
  it("reserves obligations and blocks duplicates, AP, funds and legacy errands", () => {
    const s = fresh();
    requestActivity(s, "flacco", "work");
    const before = cash(player(s));
    requestActivity(s, "flacco", "work");
    expect(cash(player(s))).toBe(before);
    expect(s.ap).toBe(1);
    expect(s.assignments.filter((a) => a.status === "active")).toHaveLength(1);
    expect(
      performAction(s, { actor: "player", target: "flacco", type: "assign" })
        .error,
    ).toContain("conversation");
    s.ap = 0;
    expect(requestError(s, "flacco", "social")).toContain("AP");
    const broke = fresh();
    player(broke).wallet = { clean: 0, illicit: 0 };
    expect(requestError(broke, "flacco", "work")).toContain("$12");
  });
  it("NPC employment blocks simultaneous assignments and AI attends its shift", () => {
    let s = fresh();
    // Use the actual NPC employment API; no separate labor-market simulation.
    return import("../content/jobs").then(({ JOBS }) => {
      const j = JOBS.find((j) => j.id === "retail-south")!;
      applyForJob(s, "flacco", j.id);
      acceptJob(s, "flacco", j.id);
      while (!s.employment[0].workdays.includes((s.day + 1 - 1) % 7))
        s = advanceDay(s);
      expect(cooperation(s, s.characters.flacco, "work").accepted).toBe(false);
      s = advanceDay(s);
      generateShifts(s);
      expect(availability(s, s.characters.flacco)).toContain("scheduled shift");
      expect(
        s.employment[0].attendance.some(
          (a) => a.day === s.day && a.status === "worked",
        ),
      ).toBe(true);
    });
  });
  it("removal keeps identity, skills, affiliations, commitments and memories without a reset exploit", () => {
    let s = speak(fresh(), "flacco", "social");
    s = action(s, "remove", "flacco");
    const c = structuredClone(s.characters.flacco);
    expect(s.crew.members).not.toContain("flacco");
    expect(c.memories.some((m) => m.meaning.includes("Removed me"))).toBe(true);
    s = advanceDay(s);
    expect(s.characters.flacco.lastActionDay).toBe(s.day);
    s = action(s, "recruit", "flacco");
    expect(s.characters.flacco.skills.social).toBeGreaterThanOrEqual(
      c.skills.social,
    );
    expect(s.characters.flacco.skills.work).toBeGreaterThanOrEqual(
      c.skills.work,
    );
    expect(s.characters.flacco.memories.length).toBeGreaterThanOrEqual(
      c.memories.length,
    );
    expect(s.characters.flacco.relationships.player.trust).toBeLessThan(90);
  });
});

describe("autonomous offers and extended seeded campaigns", () => {
  it.each([1, 7, 21, 83, 2026, 5099])(
    "60 days seed %i: independent lives, occasional offers, real appointments, save/load and bounded growth",
    (seed) => {
      let s = recruitNaturally(seed),
        accepted = 0,
        declined = 0,
        expired = 0,
        resolved = 0;
      const openingWork = s.characters.flacco.skills.work;
      while (s.day <= 60) {
        for (const o of s.crewOffers.filter((o) => o.status === "pending")) {
          if (accepted === 0) {
            acceptCrewOffer(s, o.id);
            if (o.status === "accepted") accepted++;
          } else if (declined === 0) {
            const r = s.characters[o.member].relationships.player.trust;
            o.status = "declined";
            expect(s.characters[o.member].relationships.player.trust).toBe(r);
            declined++;
          }
        }
        for (const a of s.assignments.filter(
          (a) => a.status === "accepted" && a.dueDay === s.day,
        )) {
          if (!attendError(s, a.id)) {
            attendCrewActivity(s, a.id);
            resolved++;
          }
        }
        if (s.ap && !availability(s, s.characters.flacco))
          requestActivity(s, "flacco", s.day % 3 === 0 ? "work" : "social");
        if (s.ap && !performAction(s, { actor: s.playerId, type: "gig" }).error)
          s = action(s, "gig");
        s = deserialize(serialize(advanceDay(s)));
        expect(s.end).toBeNull();
        expect(s.ap).toBe(2);
        expect(cash(player(s))).toBeGreaterThanOrEqual(0);
        expect(
          s.crewOffers.filter((o) => o.status === "pending").length,
        ).toBeLessThanOrEqual(1);
        expect(
          s.encounters.filter((e) => e.status === "active").length,
        ).toBeLessThanOrEqual(1);
      }
      expired = s.crewOffers.filter((o) => o.status === "expired").length;
      expect(accepted).toBe(1);
      expect(resolved).toBe(1);
      expect(declined).toBe(1);
      expect(expired).toBeGreaterThan(0);
      expect(s.crewOffers.length).toBeLessThanOrEqual(10);
      for (let i = 1; i < s.crewOffers.length; i++)
        expect(
          s.crewOffers[i].createdDay - s.crewOffers[i - 1].createdDay,
        ).toBeGreaterThanOrEqual(CREW_BALANCE.globalCooldown);
      expect(s.characters.flacco.skills.work).toBeGreaterThan(openingWork);
      expect(s.characters.flacco.skills.work).toBeLessThanOrEqual(85);
      expect(s.characters.flacco.memories.length).toBeGreaterThan(20);
      expect(s.characters["resident-south"].lastActionDay).toBeGreaterThan(50);
      expect(s.incidents["the-chains"].status).not.toBe("active");
      expect(
        s.encounters
          .filter(
            (e) =>
              e.definitionId === "crew-offer" &&
              ["active", "pending"].includes(e.status),
          )
          .every((e) =>
            s.crewOffers.some(
              (o) =>
                o.id === e.crewOfferId &&
                o.status === "pending" &&
                o.activityDay >= s.day,
            ),
          ),
      ).toBe(true);
    },
  );
  it("replays offers and assignments deterministically", () => {
    const run = () => {
      let s = fresh(999);
      for (let i = 0; i < 30; i++) {
        if (s.ap && !availability(s, s.characters.flacco))
          requestActivity(s, "flacco", i % 2 ? "work" : "social");
        s = advanceDay(s);
      }
      return s;
    };
    expect(run()).toEqual(run());
  });
});

describe("assignment boundaries and personal consequences", () => {
  it("shared risky outcomes expose and reward or cost both people through the existing engine", () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = fresh(seed),
        c = s.characters.flacco;
      c.traits.risk = 80;
      c.traits.lawful = 10;
      c.skills.recovery = 60;
      acquire(s, "mega", "consignment");
      requestActivity(s, c.id, "partner-crime");
      const a = s.assignments[0];
      expect(a.status).toBe("resolved");
      outcomes.add(a.success!);
      expect(s.ap).toBe(0);
      expect(player(s).police).toBeGreaterThan(0);
      expect(c.police).toBeGreaterThan(0);
      const t = s.street.transactions.at(-1)!;
      expect(c.wallet.clean + c.wallet.illicit).toBe(
        80 + t.crewPaid - t.crewLoss,
      );
      expect(t.partner).toBe(c.id);
      const raw = serialize(s);
      processCrewActivities(s);
      expect(serialize(s)).toBe(raw);
    }
    expect(outcomes).toEqual(new Set([true, false]));
  });
  it("the alternative social action entry point cannot bypass a member's refusal", () => {
    const s = fresh();
    s.characters.flacco.stress = 100;
    const r = performAction(s, {
      actor: "player",
      type: "socialize",
      target: "flacco",
    });
    expect(r.error).toBeNull();
    expect(r.state.assignments[0].status).toBe("refused");
    expect(r.state.ap).toBe(2);
    expect(r.state.characters.flacco.relationships.player.trust).toBe(
      s.characters.flacco.relationships.player.trust,
    );
  });
  it("no-show promises hurt trust; declining beforehand does not", () => {
    let s = fresh(1);
    while (!s.crewOffers.some((o) => o.status === "pending")) s = advanceDay(s);
    const o = s.crewOffers.find((o) => o.status === "pending")!;
    acceptCrewOffer(s, o.id);
    const a = s.assignments.at(-1)!;
    while (s.day < a.dueDay) s = advanceDay(s);
    const trust = s.characters[o.member].relationships.player.trust;
    s.day++;
    processCrewActivities(s);
    expect(s.assignments.find((x) => x.id === a.id)?.success).toBe(false);
    expect(s.commitments.find((c) => c.id === a.commitmentId)?.status).toBe(
      "broken",
    );
    expect(s.characters[o.member].relationships.player.trust).toBe(trust - 4);
    expect(
      s.characters[o.member].memories.some((m) =>
        m.meaning.includes("didn't show up"),
      ),
    ).toBe(true);
  });
  it("a newly conflicting employment schedule prevents attendance and never pays", () => {
    let s = fresh(1);
    while (!s.crewOffers.some((o) => o.status === "pending")) s = advanceDay(s);
    const o = s.crewOffers.find((o) => o.status === "pending")!;
    acceptCrewOffer(s, o.id);
    const a = s.assignments.at(-1)!;
    applyForJob(s, o.member, "retail-south");
    acceptJob(s, o.member, "retail-south");
    s.employment[0].workdays = [0, 1, 2, 3, 4, 5, 6];
    s = advanceDay(s);
    expect(attendError(s, a.id)).toContain("scheduled shift");
    const before = cash(player(s));
    attendCrewActivity(s, a.id);
    expect(cash(player(s))).toBe(before);
    expect(s.assignments.find((x) => x.id === a.id)?.status).toBe("accepted");
  });
  it("does not accept fabricated partner boosts, malformed references or duplicate assignments", () => {
    const s = fresh();
    expect(
      performAction(s, { actor: "player", type: "crime", partner: "mega" })
        .error,
    ).toContain("active shared assignment");
    requestActivity(s, "flacco", "work");
    const bad = structuredClone(s);
    bad.assignments[0].member = "missing";
    expect(() => deserialize(serialize(bad))).toThrow(/references/);
    const duplicate = structuredClone(s);
    duplicate.assignments.push(structuredClone(duplicate.assignments[0]));
    expect(() => deserialize(serialize(duplicate))).toThrow(/references/);
  });
});

it("removal immediately withdraws an invitation, and re-recruitment preserves its cooldown and history", () => {
  let s = fresh(1);
  while (!s.crewOffers.some((o) => o.status === "pending")) s = advanceDay(s);
  const offer = s.crewOffers.find((o) => o.status === "pending")!,
    lastOfferDay = s.characters[offer.member].agency.lastOfferDay;
  s = action(s, "remove", offer.member);
  expect(s.crewOffers.find((o) => o.id === offer.id)?.status).toBe("expired");
  expect(
    s.encounters.filter(
      (e) =>
        e.crewOfferId === offer.id && ["pending", "active"].includes(e.status),
    ),
  ).toHaveLength(0);
  s = action(s, "recruit", offer.member);
  expect(s.crewOffers.find((o) => o.id === offer.id)?.status).toBe("expired");
  expect(s.characters[offer.member].agency.lastOfferDay).toBe(lastOfferDay);
  expect(
    s.characters[offer.member].memories.some((m) =>
      m.meaning.includes("Removed me"),
    ),
  ).toBe(true);
});
