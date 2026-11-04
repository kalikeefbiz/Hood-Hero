import { QUANNY_ENCOUNTER } from "./quannyEncounters";
import { DANGER_ENCOUNTER } from "./dangerEncounters";
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
    return "You said you had me, Cuzzo. I waited on that. The chain’s gone now. We can still talk, but I’m not forgetting it.";
  if (promise?.status === "fulfilled")
    return "You came through for me. I got my chain back, and I know what you did to make that happen. That means something.";
  if (i?.status === "resolved")
    return promise?.status === "superseded"
      ? "Pablo handled it. My chain’s back. You didn’t get the chance to finish what you promised — we’re square on that."
      : i.resolvedBy === s.playerId
        ? "My chain’s back. You helped me get it home. I appreciate that, Cuzzo."
        : "My chain’s back. Leadership sorted it out. I’m glad it’s over.";
  if (i?.status === "abandoned")
    return "They sold it. There’s no buying it back from them now. I’ve got to move on.";
  if (promise?.status === "pending")
    return i.leadershipAware
      ? "You said you’d help. Pablo’s heard about it now, so I’m waiting to see what he does. Nothing’s settled yet."
      : "I’m counting on you. They still have my chain. Talk them down, cover the demand, or see if Pablo will handle his people. Just don’t let this sit.";
  if (e.selectedResponses.at(-1)?.id === "decline")
    return "Alright. I wanted your help, but I heard you. I’ll figure out what I can do.";
  if (e.selectedResponses.some((r) => r.id === "clarify"))
    return `Dizzy, Baby Canon, Joker. Three of them, trying to get a name. They want $${i.demand}. Loco’s locked up; Pablo runs things out here. This wasn’t authorized. I wasn’t badly hurt. I want my property back, not more trouble.`;
  return `Cuzzo, three young Angels took my diamond chain while I was out with my girl. I’m alright. They want $${i.demand} to give it back. ${i.leadershipAware ? "Pablo’s heard about it, but nothing’s settled. " : ""}Can you help me get it home?`;
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
        label: "I hear you. Return to the city.",
        effect: { type: "acknowledge" },
      },
    ];
  const responses: EncounterResponse[] = [];
  if (!incidentPromise(s, i.id)) {
    responses.push({
      id: "promise",
      label: "I’ll help you get it back. I give you my word.",
      effect: { type: "promise" },
    });
    if (!e.selectedResponses.some((r) => r.id === "clarify"))
      responses.push({
        id: "clarify",
        label: "Tell me what happened. Who was involved?",
        effect: { type: "clarify" },
      });
    if (!e.selectedResponses.some((r) => r.id === "decline"))
      responses.push({
        id: "decline",
        label: "I can’t get involved in this.",
        effect: { type: "decline" },
      });
    responses.push({
      id: "delay",
      label: "Let me think. I’m not promising yet.",
      effect: { type: "delay" },
    });
  }
  if (incidentPromise(s, i.id) || i.informed) {
    for (const [id, type, label, target] of [
      ["negotiate", "negotiate", "Talk down the demand", undefined],
      ["buyback", "buyback", "Pay to return the chains", undefined],
      ["settlement", "settlement", "Bring the dispute to Pablo", "pablo"],
      ["recover", "recover", "Attempt property recovery", undefined],
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
  QUANNY_ENCOUNTER,
  DANGER_ENCOUNTER,
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
        label: "I hear you. Return to the city.",
        effect: { type: "acknowledge" },
      },
    ],
    rules: { replay: "read-only", expiresWithIncident: false },
  },
];
