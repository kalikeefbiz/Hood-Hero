import { copy } from "./copy";
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
    return copy("crew-dialogue.availabilityDetails", {
      availability:
        availability(s, c) ?? copy("crew-dialogue.iVeGotSomeTimeWhatDid"),
      details:
        c.relationships[s.playerId]?.trust >= 55
          ? copy("crew-dialogue.weVeGotHistoryJustRememberI")
          : copy("crew-dialogue.letSBeStraightAboutWhatWe"),
    });
  },
  responses: (s, e) => {
    const c = member(s, e);
    const rows: EncounterResponse[] = [];
    for (const a of s.assignments.filter(
      (a) => a.member === c.id && a.status === "accepted",
    ))
      rows.push({
        id: `attend-${a.id}`,
        label: copy("crew-dialogue.joinScheduledActivityDayDeadline1AP", {
          deadline: a.dueDay,
        }),
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
          ? copy(
              "crew-dialogue.12ReservedCompensationPossibleAmountTomorrowChance",
              { amount: 24 + Math.floor(c.skills.work / 6), chance: chance },
            )
          : activity === "partner-gig"
            ? copy("crew-dialogue.sameDailyGigLimitBothEarnSkills")
            : activity === "partner-crime"
              ? copy("crew-dialogue.requiresHeldMerchandise15OfActualGross")
              : activity === "social"
                ? copy("crew-dialogue.trustAffectionAndStressRelief")
                : copy(
                    "crew-dialogue.onlyTheirContactsAndKnowledgeChanceChance",
                    { chance: chance },
                  );
      rows.push({
        id: activity,
        label: activityName[activity],
        detail: copy("crew-dialogue.1APIfAcceptedDetailsReason", {
          details: detail,
          reason: !decision.accepted
            ? copy("crew-dialogue.contextReason", {
                decision: decision.negotiate
                  ? copy("crew-dialogue.negotiate")
                  : copy("crew-dialogue.likelyRefusal"),
                reason: decision.reason,
              })
            : "",
        }),
        effect: { type: "crew", choice: "request", activity },
        requirement: () => requestError(s, c.id, activity),
      });
      if (activity === "work" && decision.negotiate)
        rows.push({
          id: "work-negotiated",
          label: copy("crew-dialogue.agreeTo18Compensation1APIf"),
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
      label: copy("crew-dialogue.catchYouLaterReturnToCity"),
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
      : copy("crew-dialogue.somebodyIKnow");
    const intro =
      o.activity === "partner-gig"
        ? copy("crew-dialogue.ayeContactIsLookingForLocalHelp", {
            contact: contact,
            deadline: o.activityDay,
          })
        : o.activity === "social"
          ? copy("crew-dialogue.iVeHadALotOnMy", { deadline: o.activityDay })
          : copy("crew-dialogue.iCouldIntroduceYouToContactOn", {
              contact: contact,
              deadline: o.activityDay,
            });
    return copy("crew-dialogue.introDeadlineReaction", {
      intro: intro,
      details: e.selectedResponses.some((r) => r.id === "details")
        ? copy("crew-dialogue.itTakes1APWhenWeMeet", {
            terms:
              o.activity === "partner-gig"
                ? copy("crew-dialogue.sameLocalGigAsUsualOncePer")
                : copy("crew-dialogue.noCashPaymentWeBothMakeTime"),
          })
        : copy("crew-dialogue.letMeKnowByDayDeadline", {
            deadline: Math.min(o.expiresDay, o.activityDay),
          }),
      reaction:
        c.stress > 35
          ? copy("crew-dialogue.iCouldReallyUseTheBreak")
          : copy("crew-dialogue.noPressureIfYouVeGotOther"),
    });
  },
  responses: (s, e) => [
    {
      id: "accept-offer",
      label: copy("crew-dialogue.iMInScheduleDayDeadline1", {
        deadline: offer(s, e)!.activityDay,
      }),
      effect: { type: "crew", choice: "accept" },
      requirement: () => offerError(s, offer(s, e)!.id),
    },
    ...(!e.selectedResponses.some((r) => r.id === "details")
      ? [
          {
            id: "details",
            label: copy("crew-dialogue.tellMeMoreAboutIt"),
            effect: { type: "crew" as const, choice: "details" },
          },
        ]
      : []),
    {
      id: "decline-offer",
      label: copy("crew-dialogue.canTMakeItYouGoAhead"),
      effect: { type: "crew", choice: "decline" },
    },
  ],
  rules: { replay: "read-only", expiresWithIncident: false },
};
