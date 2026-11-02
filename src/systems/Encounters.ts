import type { EncounterInstance, GameState } from "../core/GameState";
import { encounterDefinition, syncEncounters } from "./EncounterLifecycle";
export {
  encounterDefinition,
  syncEncounters,
  currentEncounter,
  openEncounter,
  dismissEncounter,
} from "./EncounterLifecycle";
import { resolveWorkplace } from "./Workplace";
import { performAction, validateAction } from "../core/ActionEngine";
import { acknowledgeEvent, record } from "../core/EventLog";
import { promiseHelp } from "./Commitments";
import type { EncounterResponse } from "../core/Encounter";
export function responseError(
  s: GameState,
  e: EncounterInstance,
  r: EncounterResponse,
): string | null {
  if (s.end) return "This run has ended";
  if (!encounterDefinition(e).eligible(s, e))
    return "This conversation is no longer available";
  if (e.status !== "active") return "Open the conversation first";
  if (r.effect.type === "action") return validateAction(s, r.effect.action);
  return r.requirement?.(s, e) ?? null;
}
export function respondEncounter(
  state: GameState,
  id: string,
  responseId: string,
): { state: GameState; error: string | null } {
  const original = state.encounters.find((e) => e.id === id);
  const response =
    original &&
    encounterDefinition(original)
      .responses(state, original)
      .find((r) => r.id === responseId);
  if (!original || !response)
    return { state, error: "This response is no longer available" };
  const error = responseError(state, original, response);
  if (error) return { state, error };
  const startEvent = state.events.length;
  let s = structuredClone(state);
  const effect = response.effect;
  if (effect.type === "workplace") {
    resolveWorkplace(
      s,
      s.encounters.find((e) => e.id === id)!,
      effect.choice,
    );
    syncEncounters(s);
    return { state: s, error: null };
  } else if (effect.type === "action") {
    const result = performAction(s, effect.action);
    if (result.error) return { state, error: result.error };
    s = result.state;
  } else {
    const e = s.encounters.find((e) => e.id === id)!;
    const incident = e.incidentId ? s.incidents[e.incidentId] : undefined;
    if (incident && effect.type !== "acknowledge") incident.informed = true;
    if (effect.type === "promise" && incident) promiseHelp(s, incident, e.id);
    if (effect.type === "decline")
      record(
        s,
        "social",
        "You told Cuzzo you would not get involved. No promise was made.",
        [s.playerId, "mega"],
        undefined,
        { incidentId: e.incidentId },
      );
    if (effect.type === "delay") {
      e.status = "pending";
      e.deferred = true;
      record(
        s,
        "social",
        "You asked Cuzzo for time to think. You made no promise; the dispute continues.",
        [s.playerId, "mega"],
        undefined,
        { incidentId: e.incidentId },
      );
    }
    if (effect.type === "promise" || effect.type === "decline") {
      e.status = "acknowledged";
      e.followUpPending = false;
    }
    if (effect.type === "acknowledge") {
      if (e.sourceEventId) s = acknowledgeEvent(s, e.sourceEventId);
      else e.status = "acknowledged";
    }
  }
  s.encounters
    .find((e) => e.id === id)!
    .selectedResponses.push({
      id: responseId,
      day: s.day,
      eventIds: s.events.slice(startEvent).map((e) => e.id),
    });
  syncEncounters(s);
  return { state: s, error: null };
}
