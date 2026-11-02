import type { EncounterDefinition, EncounterResponse } from "../core/Encounter";
import type { EncounterInstance, GameState } from "../core/GameState";
import {
  activityName,
  assignmentChance,
  attendError,
  availability,
  cooperation,
  offerError,
  requestError,
} from "../systems/CrewAgency";
const member = (s: GameState, e: EncounterInstance) =>
  s.characters[e.participants[0]];
const offer = (s: GameState, e: EncounterInstance) =>
  s.crewOffers.find((o) => o.id === e.crewOfferId);
export const CREW_CONVERSATION: EncounterDefinition = {
  id: "crew-conversation",
  type: "request",
  participants: [],
  priority: 75,
  trigger: () => [],
  eligible: (s, e) =>
    s.crew.members.includes(e.participants[0]) &&
    !["closed", "acknowledged"].includes(e.status),
  expression: () => "strategizing",
  dialogue: (s, e) => {
    const c = member(s, e);
    return `${availability(s, c) ?? "I've got some time. What did you have in mind?"} ${c.relationships[s.playerId]?.trust >= 55 ? "We've got history. Just remember I've got my own limits." : "Let's be straight about what we're asking of each other."}`;
  },
  responses: (s, e) => {
    const c = member(s, e);
    const rows: EncounterResponse[] = [];
    for (const a of s.assignments.filter(
      (a) => a.member === c.id && a.status === "accepted",
    ))
      rows.push({
        id: `attend-${a.id}`,
        label: `Join scheduled activity · day ${a.dueDay} · 1 AP`,
        effect: { type: "crew", choice: "attend", assignmentId: a.id },
        requirement: () => attendError(s, a.id),
      });
    for (const activity of [
      "work",
      "information",
      "social",
      "partner-gig",
      "partner-crime",
    ] as const) {
      const decision = cooperation(s, c, activity);
      const chance = Math.round(assignmentChance(s, c, activity) * 100);
      const detail =
        activity === "work"
          ? `$12 reserved compensation · possible $${24 + Math.floor(c.skills.work / 6)} tomorrow · ${chance}% reliability`
          : activity === "partner-gig"
            ? "same daily gig limit · both earn; skills affect pay"
            : activity === "partner-crime"
              ? "requires held merchandise · 15% of actual gross to partner · both face exposure and loss"
              : activity === "social"
                ? "trust, affection and stress relief"
                : `only their contacts and knowledge · ${chance}% chance of useful information`;
      rows.push({
        id: activity,
        label: activityName[activity],
        detail: `1 AP if accepted · ${detail}${!decision.accepted ? ` · ${decision.negotiate ? "Negotiate" : "Likely refusal"}: ${decision.reason}` : ""}`,
        effect: { type: "crew", choice: "request", activity },
        requirement: () => requestError(s, c.id, activity),
      });
      if (activity === "work" && decision.negotiate)
        rows.push({
          id: "work-negotiated",
          label: "Agree to $18 compensation · 1 AP if accepted",
          effect: {
            type: "crew",
            choice: "request",
            activity,
            compensation: 18,
          },
          requirement: () => requestError(s, c.id, activity, 18),
        });
    }
    rows.push({
      id: "leave",
      label: "Catch you later. Return to City.",
      effect: { type: "crew", choice: "leave" },
    });
    return rows;
  },
  rules: { replay: "read-only", expiresWithIncident: false },
};
export const CREW_OFFER: EncounterDefinition = {
  id: "crew-offer",
  type: "request",
  participants: [],
  priority: 65,
  trigger: (s) =>
    s.crewOffers
      .filter((o) => o.status === "pending")
      .map((o) => ({ key: o.id })),
  eligible: (s, e) => {
    const o = offer(s, e);
    return (
      !!o &&
      o.status === "pending" &&
      s.day <= o.expiresDay &&
      s.day <= o.activityDay &&
      s.crew.members.includes(o.member) &&
      s.characters[o.member].status === "active"
    );
  },
  expression: () => "proposing",
  dialogue: (s, e) => {
    const o = offer(s, e)!,
      c = member(s, e),
      p = s.characters[s.playerId];
    const contact = p.known.includes(o.contact)
      ? s.characters[o.contact].name
      : "somebody I know";
    const intro =
      o.activity === "partner-gig"
        ? `Aye, ${contact} is looking for local help on day ${o.activityDay}. We could make a little bread. You tryna come?`
        : o.activity === "social"
          ? `I've had a lot on my mind. Could use some time with a friend on day ${o.activityDay}. You free?`
          : `I could introduce you to ${contact} on day ${o.activityDay}. Might be useful for both of us.`;
    return `${intro} ${e.selectedResponses.some((r) => r.id === "details") ? `It takes 1 AP when we meet. ${o.activity === "partner-gig" ? "Same local gig as usual, once per day. You get $38 plus a small work-skill bonus; I get $16. No wages before we work." : "No cash payment. We both make time; I can only share what I know."} If you can't come, I'll keep on with my own day.` : `Let me know by day ${Math.min(o.expiresDay, o.activityDay)}.`} ${c.stress > 35 ? "I could really use the break." : "No pressure if you've got other plans."}`;
  },
  responses: (s, e) => [
    {
      id: "accept-offer",
      label: `I'm in. Schedule day ${offer(s, e)!.activityDay} · 1 AP on arrival`,
      effect: { type: "crew", choice: "accept" },
      requirement: () => offerError(s, offer(s, e)!.id),
    },
    ...(!e.selectedResponses.some((r) => r.id === "details")
      ? [
          {
            id: "details",
            label: "Tell me more about it.",
            effect: { type: "crew" as const, choice: "details" },
          },
        ]
      : []),
    {
      id: "decline-offer",
      label: "Can't make it. You go ahead. No friendship penalty.",
      effect: { type: "crew", choice: "decline" },
    },
  ],
  rules: { replay: "read-only", expiresWithIncident: false },
};
