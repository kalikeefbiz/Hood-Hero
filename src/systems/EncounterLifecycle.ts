import type { EncounterInstance, GameState } from "../core/GameState";
import { ENCOUNTERS } from "../content/encounters";
import { record } from "../core/EventLog";
import { incidentDueDay } from "./Commitments";
export const encounterDefinition = (e: EncounterInstance) =>
  ENCOUNTERS.find((d) => d.id === e.definitionId)!;
export function syncEncounters(s: GameState) {
  if (s.end && !s.events.some((e) => e.title === `Run ended: ${s.end}`))
    record(
      s,
      "system",
      `Your run ended: ${s.end}. Your history remains available.`,
      [s.playerId],
      [s.playerId],
      { importance: "critical", title: `Run ended: ${s.end}` },
    );
  for (const definition of ENCOUNTERS) {
    for (const trigger of definition.trigger(s)) {
      const id = `${definition.id}:${trigger.key}`;
      if (s.encounters.some((e) => e.id === id)) continue;
      const incident = trigger.incidentId
        ? s.incidents[trigger.incidentId]
        : undefined;
      s.encounters.push({
        id,
        definitionId: definition.id,
        sourceEventId: trigger.eventId,
        incidentId: trigger.incidentId,
        participants: [...definition.participants],
        createdDay: s.day,
        dueDay: incident ? incidentDueDay(incident) : undefined,
        status: "active",
        selectedResponses: [],
        followUpPending: definition.type === "reaction",
      });
    }
  }
  for (const e of s.encounters) {
    const d = encounterDefinition(e);
    if (d.rules.expiresWithIncident && !d.eligible(s, e)) {
      e.status = "closed";
      e.followUpPending = false;
    }
    if (e.revisitDay && s.day >= e.revisitDay && d.eligible(s, e)) {
      e.status = "active";
      e.revisitDay = undefined;
    }
  }
}
export function openEncounter(state: GameState, id: string): GameState {
  const e = state.encounters.find((e) => e.id === id);
  if (!e || !encounterDefinition(e).eligible(state, e)) return state;
  const s = structuredClone(state);
  for (const x of s.encounters) if (x.status === "active") x.status = "pending";
  s.encounters.find((x) => x.id === id)!.status = "active";
  return s;
}
export function dismissEncounter(state: GameState, id: string): GameState {
  const s = structuredClone(state),
    e = s.encounters.find((e) => e.id === id);
  if (e)
    e.status = e.sourceEventId
      ? "pending"
      : e.selectedResponses.some(
            (r) => r.id === "promise" || r.id === "decline",
          )
        ? "acknowledged"
        : "pending";
  return s;
}
export function currentEncounter(s: GameState) {
  return s.encounters
    .filter(
      (e) => e.status === "active" && encounterDefinition(e).eligible(s, e),
    )
    .sort(
      (a, b) =>
        encounterDefinition(b).priority - encounterDefinition(a).priority ||
        s.encounters.indexOf(b) - s.encounters.indexOf(a),
    )[0];
}
