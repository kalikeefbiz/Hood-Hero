import { copy } from "./copy";
import { SUPPLIER_ENCOUNTER, SUPPLIER_REACTION } from "./streetEncounters";
import { CREW_CONVERSATION, CREW_OFFER } from "./crewEncounters";
import { WORKPLACE_ENCOUNTER } from "./workplaceEncounters";
import type { EncounterDefinition, EncounterResponse } from "../core/Encounter";
import type { EncounterInstance, GameState } from "../core/GameState";
import { unseenEvents } from "../core/EventLog";
import { incidentPromise } from "../systems/Commitments";
const chains = (s: GameState) => s.incidents["the-chains"];
export function megaDialogue(s: GameState, e: EncounterInstance): string {
  const i = chains(s),
    promise = incidentPromise(s, "the-chains");
  if (promise?.status === "broken")
    return copy("storylines.the-chains.reactions.brokenPromise");
  if (promise?.status === "fulfilled")
    return copy("storylines.the-chains.reactions.fulfilledPromise");
  if (i?.status === "resolved")
    return promise?.status === "superseded"
      ? copy("storylines.the-chains.reactions.supersededPromise")
      : i.resolvedBy === s.playerId
        ? copy("storylines.the-chains.reactions.playerResolved")
        : copy("storylines.the-chains.reactions.leadershipResolved");
  if (i?.status === "abandoned")
    return copy("storylines.the-chains.reactions.abandoned");
  if (promise?.status === "pending")
    return i.leadershipAware
      ? copy("storylines.the-chains.followUp.leadershipAware")
      : copy("storylines.the-chains.followUp.pendingPromise");
  if (e.selectedResponses.at(-1)?.id === "decline")
    return copy("storylines.the-chains.responses.declined");
  if (e.selectedResponses.some((r) => r.id === "clarify"))
    return copy("storylines.the-chains.clarification.dialogue", {
      amount: i.demand,
    });
  return copy("storylines.the-chains.opening.dialogue", {
    amount: i.demand,
    details: i.leadershipAware
      ? copy("storylines.the-chains.opening.leadershipAware")
      : "",
  });
}
function requestResponses(
  s: GameState,
  e: EncounterInstance,
): EncounterResponse[] {
  const i = chains(s);
  if (!i || i.status !== "active")
    return [
      {
        id: "acknowledge",
        label: copy("storylines.the-chains.choices.acknowledge"),
        effect: { type: "acknowledge" },
      },
    ];
  const responses: EncounterResponse[] = [];
  if (!incidentPromise(s, i.id)) {
    responses.push({
      id: "promise",
      label: copy("storylines.the-chains.choices.promise"),
      effect: { type: "promise" },
    });
    if (!e.selectedResponses.some((r) => r.id === "clarify"))
      responses.push({
        id: "clarify",
        label: copy("storylines.the-chains.choices.clarify"),
        effect: { type: "clarify" },
      });
    if (!e.selectedResponses.some((r) => r.id === "decline"))
      responses.push({
        id: "decline",
        label: copy("storylines.the-chains.choices.decline"),
        effect: { type: "decline" },
      });
    responses.push({
      id: "delay",
      label: copy("storylines.the-chains.choices.delay"),
      effect: { type: "delay" },
    });
  }
  if (incidentPromise(s, i.id) || i.informed) {
    for (const [id, type, label, target] of [
      [
        "negotiate",
        "negotiate",
        copy("storylines.the-chains.choices.negotiate"),
        undefined,
      ],
      [
        "buyback",
        "buyback",
        copy("storylines.the-chains.choices.buyback"),
        undefined,
      ],
      [
        "settlement",
        "settlement",
        copy("storylines.the-chains.choices.settlement"),
        "pablo",
      ],
      [
        "recover",
        "recover",
        copy("storylines.the-chains.choices.recover"),
        undefined,
      ],
    ] as const) {
      if (
        (type === "negotiate" && i.negotiated) ||
        (type === "settlement" && i.leadershipAware)
      )
        continue;
      responses.push({
        id,
        label,
        effect: {
          type: "action",
          action: { type, target, actor: s.playerId, incidentId: i.id },
        },
      });
    }
  }
  return responses;
}
export const ENCOUNTERS: EncounterDefinition[] = [
  SUPPLIER_ENCOUNTER,
  SUPPLIER_REACTION,
  WORKPLACE_ENCOUNTER,
  CREW_CONVERSATION,
  CREW_OFFER,
  {
    id: "mega-chains-request",
    type: "request",
    participants: ["mega", "player"],
    priority: 10,
    trigger: (s) =>
      chains(s)?.status === "active"
        ? [{ key: "opening", incidentId: "the-chains" }]
        : [],
    eligible: (s, e) => s.incidents[e.incidentId!]?.status === "active",
    expression: (s, e) =>
      incidentPromise(s, "the-chains")?.status === "broken"
        ? "concerned"
        : e.selectedResponses.some((r) => r.id === "clarify") ||
            s.incidents["the-chains"]?.status === "resolved"
          ? "confident"
          : "concerned",
    dialogue: megaDialogue,
    responses: requestResponses,
    rules: { replay: "contextual", expiresWithIncident: true },
  },
  {
    id: "chains-reaction",
    type: "reaction",
    participants: ["mega", "player"],
    priority: 30,
    trigger: (s) =>
      unseenEvents(s)
        .filter((e) => e.incidentId === "the-chains")
        .map((e) => ({
          key: e.presentationKey ?? e.id,
          eventId: e.id,
          incidentId: e.incidentId,
        })),
    eligible: (s, e) => unseenEvents(s).some((x) => x.id === e.sourceEventId),
    dialogue: megaDialogue,
    responses: () => [
      {
        id: "acknowledge",
        label: copy("storylines.the-chains.choices.acknowledgeReaction"),
        effect: { type: "acknowledge" },
      },
    ],
    rules: { replay: "read-only", expiresWithIncident: false },
  },
];
