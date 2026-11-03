import { expireCrewOffers } from "./CrewAgency";
import type { EncounterInstance, GameState } from "../core/GameState";
import { ENCOUNTERS } from "../content/encounters";
import { record } from "../core/EventLog";
import { incidentDueDay } from "./Commitments";
export const encounterDefinition = (e: EncounterInstance) =>
  ENCOUNTERS.find((d) => d.id === e.definitionId)!;
const eligible = (s: GameState, e: EncounterInstance) =>
  encounterDefinition(e).eligible(s, e);
export function syncEncounters(s: GameState) {
  expireCrewOffers(s);
  if (s.end && !s.events.some((e) => e.title === `Run ended: ${s.end}`))
    record(
      s,
      "system",
      `Your run ended: ${s.end}. Your history remains available.`,
      [s.playerId],
      [s.playerId],
      { importance: "critical", title: `Run ended: ${s.end}` },
    );
  for (const definition of ENCOUNTERS)
    for (const trigger of definition.trigger(s)) {
      const id = `${definition.id}:${trigger.key}`,
        existing = s.encounters.find((e) => e.id === id);
      if (existing) {
        // A commitment consequence can enrich the same factual incident outcome.
        if (existing.status !== "acknowledged" && existing.status !== "closed")
          existing.sourceEventId = trigger.eventId;
        continue;
      }
      const incident = trigger.incidentId
        ? s.incidents[trigger.incidentId]
        : undefined;
      s.encounters.push({
        id,
        definitionId: definition.id,
        sourceEventId: trigger.eventId,
        crewOfferId: definition.id === "crew-offer" ? trigger.key : undefined,
        incidentId: trigger.incidentId,
        participants:
          definition.id === "crew-offer"
            ? [s.crewOffers.find((o) => o.id === trigger.key)!.member]
            : ["workplace", "street-reaction"].includes(definition.id)
              ? s.events
                  .find((x) => x.id === trigger.eventId)!
                  .actors.filter((id) => id !== s.playerId)
              : [...definition.participants],
        createdDay: s.day,
        dueDay: incident ? incidentDueDay(incident) : undefined,
        status: "pending",
        selectedResponses: [],
        followUpPending: definition.type === "reaction",
        deferred: false,
      });
    }
  for (const e of s.encounters)
    if (!eligible(s, e) && (e.status === "active" || e.status === "pending")) {
      e.status = "closed";
      e.followUpPending = false;
    }
  // One foreground conversation; every other eligible encounter remains queued.
  const queue = s.encounters.filter(
    (e) =>
      (e.status === "active" || (e.status === "pending" && !e.deferred)) &&
      eligible(s, e),
  );
  queue.sort(
    (a, b) =>
      encounterDefinition(b).priority - encounterDefinition(a).priority ||
      s.encounters.indexOf(a) - s.encounters.indexOf(b),
  );
  for (const e of queue) e.status = e === queue[0] ? "active" : "pending";
}
export function openEncounter(state: GameState, id: string): GameState {
  const e = state.encounters.find((e) => e.id === id);
  if (!e || !["pending", "active"].includes(e.status) || !eligible(state, e))
    return state;
  const s = structuredClone(state);
  for (const x of s.encounters) if (x.status === "active") x.status = "pending";
  const opened = s.encounters.find((e) => e.id === id)!;
  opened.status = "active";
  opened.deferred = false;
  return s;
}
export function dismissEncounter(state: GameState, id: string): GameState {
  const s = structuredClone(state),
    e = s.encounters.find((e) => e.id === id);
  if (e && e.status === "active") {
    e.status = "pending";
    e.deferred = true;
  }
  syncEncounters(s);
  return s;
}
export function currentEncounter(s: GameState) {
  return s.encounters.find((e) => e.status === "active" && eligible(s, e));
}

export function openCrewConversation(
  state: GameState,
  member: string,
): GameState {
  if (!state.crew.members.includes(member) || state.end) return state;
  const s = structuredClone(state);
  for (const e of s.encounters)
    if (e.status === "active") {
      e.status = "pending";
      e.deferred = true;
    }
  for (const e of s.encounters)
    if (
      e.definitionId === "crew-conversation" &&
      ["pending", "active"].includes(e.status)
    )
      e.status = "closed";
  s.encounters.push({
    id: `crew-conversation-${s.nextId++}`,
    definitionId: "crew-conversation",
    participants: [member],
    createdDay: s.day,
    status: "active",
    selectedResponses: [],
    followUpPending: false,
    deferred: false,
  });
  return s;
}

// A manual revisit of an active situation reuses its existing narrative definition.
export function openStoryline(state: GameState, incidentId: string): GameState {
  if (state.end || state.incidents[incidentId]?.status !== "active")
    return state;
  const s = structuredClone(state);
  for (const e of s.encounters)
    if (e.status === "active") {
      e.status = "pending";
      e.deferred = true;
    }
  let e = s.encounters.find(
    (e) =>
      e.incidentId === incidentId &&
      e.definitionId === "mega-chains-request" &&
      ["pending", "active"].includes(e.status),
  );
  if (!e) {
    e = {
      id: `story-conversation-${s.nextId++}`,
      definitionId: "mega-chains-request",
      incidentId,
      participants: ["mega", s.playerId],
      createdDay: s.day,
      status: "pending",
      selectedResponses: [],
      followUpPending: false,
      deferred: false,
    };
    s.encounters.push(e);
  }
  e.status = "active";
  e.deferred = false;
  return s;
}
