import { applyInfluence } from "./Territory";
import { saleLot, transactionChance } from "./StreetEconomy";
import {
  cash,
  clamp,
  player,
  type Character,
  type CrewActivity,
  type CrewAssignment,
  type GameState,
} from "../core/GameState";
import { record } from "../core/EventLog";
import { random } from "../core/Random";
import {
  actionSuccessChance,
  resolveAction,
  validateAction,
} from "../core/ActionEngine";
import { earn, expense } from "./Economy";
import {
  change,
  remember,
  connect,
  introductionCandidates,
} from "./Relationships";
import { currentEmployment } from "./Employment";
import { weekday } from "../content/jobs";

export const CREW_BALANCE = {
  memberCooldown: 10,
  globalCooldown: 6,
  firstOfferDay: 3,
  offerChance: 0.32,
  expiry: 1,
  compensation: 12,
  growthCap: 85,
};
export const activityName: Record<CrewActivity, string> = {
  work: "Paid local work",
  information: "Ask for information",
  social: "Spend time together",
  "partner-gig": "Partner on a local gig",
  "partner-crime": "Partner on street work",
};
export function availability(
  s: GameState,
  c: Character,
  day = s.day,
): string | null {
  if (c.status !== "active") return `I'm ${c.status}; I can't help right now.`;
  if (c.availableDay > day) return `I'm committed until day ${c.availableDay}.`;
  const job = currentEmployment(s, c.id);
  if (
    job &&
    day > job.hiredDay &&
    job.workdays.includes(weekday(day)) &&
    !job.timeOffDays.includes(day)
  )
    return "I've got a scheduled shift. I won't double-book it.";
  if (
    s.assignments.some(
      (a) =>
        a.participants.includes(c.id) &&
        ["accepted", "active"].includes(a.status) &&
        a.dueDay >= day,
    )
  )
    return "I've already given my word on another activity.";
  if (c.agency.lastAssignmentDay === day)
    return "I've already done my part today. Ask me tomorrow.";
  return null;
}
export const knownCapabilities = (c: Character) =>
  [
    `Work: ${c.skills.work >= 55 ? "experienced" : c.skills.work >= 35 ? "practiced" : "learning"}`,
    `Connections: ${c.skills.social >= 55 ? "well connected" : c.skills.social >= 35 ? "local ties" : "limited"}`,
    `Street experience: ${c.skills.recovery >= 55 ? "seasoned" : c.skills.recovery >= 35 ? "practical" : "inexperienced"}`,
  ].join(" · ");
export function cooperation(
  s: GameState,
  c: Character,
  activity: CrewActivity,
  compensation = CREW_BALANCE.compensation,
) {
  const busy =
    availability(s, c) ||
    (activity === "work" ? availability(s, c, s.day + 1) : null);
  if (busy) return { accepted: false, reason: busy, negotiate: false };
  const p = player(s),
    r = c.relationships[p.id];
  if ((r?.trust ?? 0) < 25 || (r?.grievance ?? 0) > 55)
    return {
      accepted: false,
      reason: "We need to rebuild trust before I put my word behind this.",
      negotiate: false,
    };
  const risky = activity === "partner-crime";
  if (
    risky &&
    c.affiliation &&
    p.affiliation &&
    s.factions[c.affiliation].enemies.includes(p.affiliation)
  )
    return {
      accepted: false,
      reason: "That puts me against my own people. I'm not doing it.",
      negotiate: false,
    };
  if (risky && (c.traits.lawful >= 70 || c.traits.risk < 30 || c.police >= 45))
    return {
      accepted: false,
      reason:
        c.police >= 45
          ? "I've got too much attention already. I need to stay clear."
          : "That kind of risk isn't for me. Ask me about something lawful.",
      negotiate: false,
    };
  if (c.stress > (activity === "social" ? 90 : 65))
    return {
      accepted: false,
      reason: "I'm stretched too thin. I need a quiet day to myself.",
      negotiate: false,
    };
  if (
    activity === "work" &&
    compensation < 18 &&
    (c.wallet.clean < 45 || c.traits.ambition > 65)
  )
    return {
      accepted: false,
      reason: "I need $18 for my time. Can you cover that before I commit?",
      negotiate: true,
    };
  const skill =
    activity === "information" || activity === "social"
      ? c.skills.social
      : risky
        ? c.skills.recovery
        : c.skills.work;
  const score =
    (r?.trust ?? 0) * 0.45 +
    (r?.affection ?? 0) * 0.1 +
    c.traits.loyalty * 0.15 +
    skill * 0.12 +
    (c.goals.includes(activity === "social" ? "loyalty" : "income") ? 10 : 0) +
    (activity === "work" ? compensation / 2 : activity === "social" ? 8 : 4) -
    c.stress * 0.3 -
    (r?.grievance ?? 0) * 0.3 -
    (risky ? (100 - c.traits.risk) * 0.3 + c.traits.lawful * 0.2 : 0);
  return {
    accepted: score >= (risky ? 38 : 30),
    negotiate: false,
    reason:
      score >= (risky ? 38 : 30)
        ? "Alright, that works for me. Let's keep our word to each other."
        : "I don't feel ready for that with you. Let's build some trust first.",
  };
}
export function assignmentChance(
  s: GameState,
  c: Character,
  activity: CrewActivity,
) {
  const r = c.relationships[s.playerId];
  const skill =
    activity === "information" || activity === "social"
      ? c.skills.social
      : activity === "partner-crime"
        ? c.skills.recovery
        : c.skills.work;
  return clamp(
    0.36 +
      skill / 180 +
      (r?.trust ?? 0) / 600 -
      c.stress / 350 -
      (r?.grievance ?? 0) / 500,
    0.15,
    0.92,
  );
}
export function requestError(
  s: GameState,
  member: string,
  activity: CrewActivity,
  compensation = CREW_BALANCE.compensation,
): string | null {
  if (s.end) return "This run has ended";
  if (player(s).status !== "active")
    return "You are unavailable while in custody.";
  if (!s.crew.members.includes(member)) return "Not in your Set";
  if (s.ap < 1) return "Requires 1 AP";
  if (
    s.assignments.some(
      (a) =>
        a.member === member &&
        a.activity === activity &&
        a.status === "refused" &&
        a.createdDay === s.day &&
        (activity !== "work" || a.compensation === compensation),
    )
  )
    return "You already discussed this request today. Give them some space.";
  if (activity === "work" && cash(player(s)) < compensation)
    return `Requires $${compensation} compensation held until completion`;
  if (["partner-gig", "partner-crime"].includes(activity))
    return validateAction(s, {
      actor: s.playerId,
      type: activity === "partner-gig" ? "gig" : "crime",
    });
  return null;
}
function assignment(
  s: GameState,
  member: string,
  activity: CrewActivity,
  compensation: number,
): CrewAssignment {
  return {
    id: `assignment-${s.nextId++}`,
    member,
    participants: [s.playerId, member],
    activity,
    objective: activityName[activity],
    conditions: [
      "Active participants",
      "Available time and cooperation",
      "1 AP on participation",
      ...(activity === "work"
        ? ["Reserved compensation", "No conflicting shift through completion"]
        : activity === "partner-gig"
          ? ["Daily local gig not already completed"]
          : activity === "partner-crime"
            ? ["Trusted street connection", "Compatible values and loyalties"]
            : ["Member's own preferences and knowledge"]),
    ],
    relationshipEffect:
      "Keeping the agreement can build trust; failure can reduce respect; a no-show strains trust.",
    status: "proposed",
    createdDay: s.day,
    dueDay: s.day,
    apCost: 1,
    compensation:
      activity === "work"
        ? compensation
        : activity === "partner-gig"
          ? 16
          : activity === "partner-crime"
            ? 20
            : 0,
    expectedBenefit:
      activity === "work"
        ? 24 + Math.floor(s.characters[member].skills.work / 6)
        : activity === "partner-gig"
          ? 38 +
            Math.max(0, Math.floor((s.characters[member].skills.work - 25) / 8))
          : activity === "partner-crime"
            ? Math.min(saleLot(s)?.remaining ?? 0, 2) * 50
            : 0,
    skill:
      activity === "information" || activity === "social"
        ? "social"
        : activity === "partner-crime"
          ? "recovery"
          : "work",
    chance:
      activity === "partner-crime"
        ? transactionChance(s, s.playerId, undefined, member)
        : ["social", "partner-gig"].includes(activity)
          ? 1
          : assignmentChance(s, s.characters[member], activity),
    risk:
      activity === "partner-crime"
        ? "Police, rival exposure and financial loss for both"
        : activity === "work"
          ? "No pay if unreliable; compensation still owed"
          : "Time and relationship",
    experience: 0,
    eventIds: [],
  };
}
function logAssignment(
  s: GameState,
  a: CrewAssignment,
  text: string,
  weight = 3,
) {
  const e = record(s, "crew", text, a.participants, a.participants, {
    importance: "routine",
    commitmentId: a.commitmentId,
  });
  a.eventIds.push(e.id);
  for (const [who, about] of [
    [a.member, s.playerId],
    [s.playerId, a.member],
  ])
    remember(s, who, about, e.id, text, weight);
  return e;
}
function commitment(s: GameState, a: CrewAssignment) {
  const id = `commitment-${s.nextId++}`;
  s.commitments.push({
    id,
    origin: a.id,
    requester: s.playerId,
    actor: a.member,
    beneficiary: s.playerId,
    createdDay: s.day,
    dueDay: a.dueDay,
    kind: "crew-activity",
    status: "pending",
    evidence: [],
    warned: false,
    consequences: {
      fulfilled: { trust: 3, respect: 2, grievance: 0 },
      broken: { trust: -4, respect: -2, grievance: 3 },
      released: { trust: 0, respect: 0, grievance: 0 },
    },
  });
  a.commitmentId = id;
}
// Called only on a validated owned snapshot, including through encounter responses.
export function requestActivity(
  s: GameState,
  member: string,
  activity: CrewActivity,
  compensation = CREW_BALANCE.compensation,
) {
  if (requestError(s, member, activity, compensation)) return;
  const c = s.characters[member],
    a = assignment(s, member, activity, compensation),
    decision = cooperation(s, c, activity, compensation);
  s.assignments.push(a);
  if (!decision.accepted) {
    a.status = "refused";
    a.relationshipEffect =
      "Refusal creates no obligation or automatic friendship penalty.";
    // Refusals are free. Repeating an unreasonable request once per later day erodes trust gradually.
    const repeated =
      c.agency.lastRequestDay < s.day && c.agency.unreasonableRequests >= 2;
    if (c.agency.lastRequestDay !== s.day) c.agency.unreasonableRequests++;
    if (repeated) change(c, s.playerId, { trust: -2, grievance: 2 });
    c.agency.lastRequestDay = s.day;
    a.outcome = `${c.name}: “${decision.reason}”${repeated ? " Repeated pressure strained your relationship." : " No new obligation."}`;
    logAssignment(s, a, a.outcome, repeated ? -2 : 0);
    return;
  }
  s.ap--;
  c.agency.lastAssignmentDay = s.day;
  c.agency.unreasonableRequests = Math.max(
    0,
    c.agency.unreasonableRequests - 1,
  );
  a.status = "active";
  if (activity === "work") {
    expense(s, player(s), compensation, `Reserved compensation · ${c.name}`);
    a.dueDay = s.day + 1;
    c.availableDay = s.day + 2;
  }
  commitment(s, a);
  logAssignment(
    s,
    a,
    `${c.name} accepted ${a.objective.toLowerCase()}. ${activity === "work" ? `$${compensation} reserved for their time; possible $${a.expectedBenefit} on day ${a.dueDay}. No earnings yet.` : "1 AP committed; both of you participate."}`,
  );
  if (activity !== "work") resolveAssignment(s, a);
}
function shareInformation(s: GameState, a: CrewAssignment) {
  const c = s.characters[a.member],
    p = player(s);
  const contact = introductionCandidates(s, p.id, c.id)[0];
  if (contact) {
    connect(s, p.id, contact);
    change(s.characters[contact], p.id, { trust: 2 });
    return `${c.name} introduced you to ${s.characters[contact].name}, someone they actually know.`;
  }
  const i = s.incidents["the-chains"];
  if (
    i?.status === "active" &&
    (c.id === i.victim ||
      c.known.includes(i.victim) ||
      c.known.some((id) => i.participants.includes(id)))
  ) {
    i.informed = true;
    return `${c.name}: “Mega says the group is holding his chain and asking $${i.demand}. I don't know who has it personally.”`;
  }
  return `${c.name}: “I checked my own contacts. Nothing new I can verify. Don't mistake that for the whole picture.”`;
}
export function resolveAssignment(s: GameState, a: CrewAssignment) {
  if (a.status !== "active" || a.dueDay > s.day) return;
  const c = s.characters[a.member],
    p = player(s);
  // Membership changes do not erase promises; incapacitation can still break them.
  a.success =
    c.status === "active" &&
    p.status === "active" &&
    random(s) < assignmentChance(s, c, a.activity);
  let outcome = "";
  if (a.activity === "work") {
    c.wallet.clean += a.compensation;
    if (a.success)
      earn(s, p, a.expectedBenefit, "clean", `Completed crew work · ${c.name}`);
    c.stress = clamp(c.stress + (a.success ? 5 : 9));
    outcome = a.success
      ? `$${a.expectedBenefit} clean pay produced; ${c.name} received the reserved $${a.compensation}.`
      : `The work fell through. No pay for you; ${c.name} received $${a.compensation} for their time.`;
  } else if (a.activity === "partner-gig" || a.activity === "partner-crime") {
    const type = a.activity === "partner-gig" ? "gig" : "crime";
    const error = validateAction({ ...s, ap: s.ap + 1 }, { actor: p.id, type });
    // AP has already been paid by the assignment, so restore it only around the existing resolver.
    if (c.status !== "active" || error) {
      a.success = false;
      outcome =
        "The shared opportunity is no longer eligible. No proceeds or exposure were created.";
    } else {
      s.ap++;
      const before = cash(p);
      resolveAction(s, { actor: p.id, type, partner: c.id });
      a.success = cash(p) > before;
      if (type === "gig") {
        const bonus = Math.max(0, Math.floor((c.skills.work - 25) / 8));
        earn(s, p, bonus, "clean", "Partner's work contribution");
        c.wallet.clean += 16;
        c.stress = clamp(c.stress + 5);
        outcome = `Shared local gig: you earned $${38 + bonus}; ${c.name} earned $16. Work experience determined the extra pay.`;
      } else {
        const transaction = s.street.transactions.at(-1);
        a.success = !!transaction?.gross;
        outcome = `Shared street transaction: ${transaction?.sold ?? 0} goods sold. ${c.name} received $${transaction?.crewPaid ?? 0} from actual proceeds${transaction?.crewLoss ? ` and lost $${transaction.crewLoss}` : ""}; only participants gained exposure. Supplier debt remains with the owner.`;
      }
    }
  } else if (a.activity === "social") {
    a.success = true;
    const relief = c.goals.includes("loyalty") ? 10 : 6;
    c.stress = clamp(c.stress - relief);
    p.stress = clamp(p.stress - relief);
    change(c, p.id, { trust: 5, affection: 5, grievance: -3 });
    change(p, c.id, { trust: 4, affection: 4 });
    p.influence++;
    outcome = `You spent time together. Both stress −${relief}; trust and affection grew. ${c.goals.includes("loyalty") ? "Making time for friendship matters to them." : "They appreciated a break from their own responsibilities."}`;
  } else
    outcome = a.success
      ? shareInformation(s, a)
      : `${c.name}: “I asked around, but couldn't confirm anything. I'll keep my eyes open.”`;
  if (a.success) {
    applyInfluence(s, {
      actor: c.id,
      participants: [p.id],
      faction: c.affiliation === p.affiliation ? p.affiliation : null,
      zone: c.home,
      kind:
        a.activity === "work" || a.activity === "partner-gig"
          ? "economic"
          : "community",
      magnitude: 1,
      cause: `${c.name}'s completed Set commitment supported local ties.`,
    });
    if (p.affiliation && c.affiliation === p.affiliation)
      s.strategic.contributions[p.affiliation] += 5;
    a.experience = Math.min(
      1,
      Math.max(0, CREW_BALANCE.growthCap - c.skills[a.skill]),
    );
    c.skills[a.skill] += a.experience;
    change(c, p.id, { trust: 2, respect: 1 });
  } else change(c, p.id, { respect: -1 });
  a.status = "resolved";
  a.relationshipEffect = a.success
    ? "Cooperation strengthened trust and respect."
    : "Failure reduced respect; agreed compensation remains owed.";
  a.outcome = `${c.name} · ${a.objective}: ${outcome}${a.experience ? ` +${a.experience} ${a.skill} experience.` : ""}`;
  c.agency.lastAssignmentDay = s.day;
  const e = logAssignment(s, a, a.outcome, a.success ? 5 : -2);
  const promise = s.commitments.find((x) => x.id === a.commitmentId);
  if (promise) {
    promise.status = a.success ? "fulfilled" : "failed";
    promise.evidence.push(e.id);
  }
}
export function expireCrewOffers(s: GameState) {
  for (const o of s.crewOffers.filter((o) => o.status === "pending")) {
    if (
      s.end ||
      s.day > o.expiresDay ||
      s.day > o.activityDay ||
      !s.crew.members.includes(o.member) ||
      s.characters[o.member].status !== "active" ||
      s.characters[o.contact].status !== "active" ||
      availability(s, s.characters[o.member], o.activityDay)
    )
      o.status = "expired";
  }
}
export function processCrewActivities(s: GameState) {
  expireCrewOffers(s);
  for (const a of s.assignments) {
    if (a.status === "active") resolveAssignment(s, a);
    if (a.status === "accepted" && s.day > a.dueDay) {
      a.status = "resolved";
      a.success = false;
      a.relationshipEffect = "Missed appointment: trust -4, grievance +3.";
      a.outcome = `${s.characters[a.member].name}: “You didn't show up for what we agreed. I went ahead with my own day.”`;
      change(s.characters[a.member], s.playerId, { trust: -4, grievance: 3 });
      const e = logAssignment(s, a, a.outcome, -4);
      const p = s.commitments.find((c) => c.id === a.commitmentId);
      if (p) {
        p.status = "broken";
        p.evidence.push(e.id);
      }
    }
  }
}
// A deterministic decision tie-breaker does not perturb established incident/AI random draws.
function offerRoll(s: GameState, c: Character) {
  let hash = (s.rng ^ Math.imul(s.day, 2654435761)) >>> 0;
  for (const ch of c.id)
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash / 4294967296;
}
// Called by the ordinary NPC decision engine. An offer never freezes the NPC.
export function considerCrewOffer(s: GameState, c: Character) {
  if (
    !s.crew.members.includes(c.id) ||
    s.day < CREW_BALANCE.firstOfferDay ||
    availability(s, c) ||
    availability(s, c, s.day + 1) ||
    (c.relationships[s.playerId]?.trust ?? 0) < 35 ||
    c.stress > 60 ||
    (c.agency.lastOfferDay > 0 &&
      s.day - c.agency.lastOfferDay < CREW_BALANCE.memberCooldown) ||
    s.crewOffers.some(
      (o) =>
        o.status === "pending" ||
        s.day - o.createdDay < CREW_BALANCE.globalCooldown,
    ) ||
    offerRoll(s, c) > CREW_BALANCE.offerChance
  )
    return;
  const contact = c.known.find(
    (id) => id !== s.playerId && s.characters[id]?.status === "active",
  );
  if (!contact) return;
  const activity =
    c.stress > 35 && c.goals.includes("loyalty")
      ? "social"
      : c.skills.social >= 55 &&
          c.known.some((id) => !player(s).known.includes(id))
        ? "information"
        : "partner-gig";
  if (!cooperation(s, c, activity).accepted) return;
  const o = {
    id: `offer-${s.nextId++}`,
    member: c.id,
    contact,
    activity,
    createdDay: s.day,
    expiresDay: s.day + CREW_BALANCE.expiry,
    activityDay: s.day + 1,
    status: "pending",
  } as const;
  s.crewOffers.push(o);
  c.agency.lastOfferDay = s.day;
  record(
    s,
    "crew",
    `${c.name} has a personal ${activity === "partner-gig" ? "work opportunity" : activity === "social" ? "invitation" : "introduction"} for day ${o.activityDay}. Reply before day ${o.expiresDay + 1}.`,
    [c.id, s.playerId],
    undefined,
    { importance: "routine" },
  );
}
export function offerError(s: GameState, offerId: string): string | null {
  const o = s.crewOffers.find((x) => x.id === offerId);
  if (
    !o ||
    o.status !== "pending" ||
    s.day > o.expiresDay ||
    s.day > o.activityDay
  )
    return "This opportunity has expired";
  if (!s.crew.members.includes(o.member)) return "They have left your Set";
  return (
    availability(s, s.characters[o.member], o.activityDay) ||
    availability(s, player(s), o.activityDay)
  );
}
export function acceptCrewOffer(s: GameState, id: string) {
  if (offerError(s, id)) return;
  const o = s.crewOffers.find((x) => x.id === id)!;
  const a = assignment(s, o.member, o.activity, 0);
  a.status = "accepted";
  a.dueDay = o.activityDay;
  a.offerId = o.id;
  s.assignments.push(a);
  o.status = "accepted";
  o.assignmentId = a.id;
  commitment(s, a);
  logAssignment(
    s,
    a,
    `${s.characters[o.member].name}: “We're on for day ${a.dueDay}. Meet me then.” Scheduled ${a.objective.toLowerCase()} · 1 AP on arrival; no pay yet.`,
  );
}
export function attendError(s: GameState, id: string) {
  const a = s.assignments.find((a) => a.id === id);
  if (!a || a.status !== "accepted" || a.dueDay !== s.day)
    return "Return on the scheduled day";
  const otherPlans = {
    ...s,
    assignments: s.assignments.filter((x) => x.id !== a.id),
  };
  return (
    requestError(s, a.member, a.activity) ||
    availability(otherPlans, s.characters[a.member]) ||
    availability(otherPlans, player(s))
  );
}
export function attendCrewActivity(s: GameState, id: string) {
  if (attendError(s, id)) return;
  const a = s.assignments.find((a) => a.id === id)!;
  a.status = "active";
  s.ap--;
  resolveAssignment(s, a);
}
