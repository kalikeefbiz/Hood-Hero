import type { GameState, GameEvent, ID } from "./GameState";
export function record(
  s: GameState,
  category: GameEvent["category"],
  text: string,
  actors: ID[] = [],
  observers: ID[] = actors,
  details: Partial<
    Pick<GameEvent, "importance" | "title" | "incidentId" | "commitmentId">
  > = {},
): GameEvent {
  const event: GameEvent = {
    importance:
      category === "city" || category === "system" ? "routine" : "personal",
    ...details,
    id: `event-${s.nextId++}`,
    day: s.day,
    category,
    text,
    actors,
    observedBy: [...new Set(observers)],
  };
  s.events.push(event);
  return event;
}
export function visibleEvents(s: GameState) {
  return s.events.filter((e) => e.observedBy.includes(s.playerId));
}

export const importantEvents = (s: GameState) =>
  visibleEvents(s).filter(
    (e) => e.importance === "major" || e.importance === "critical",
  );
export const unseenEvents = (s: GameState) =>
  importantEvents(s).filter((e) => !s.acknowledgedEvents.includes(e.id));
export function acknowledgeEvent(state: GameState, id: ID): GameState {
  if (
    !visibleEvents(state).some((e) => e.id === id) ||
    state.acknowledgedEvents.includes(id)
  )
    return state;
  const s = structuredClone(state);
  s.acknowledgedEvents.push(id);
  for (const encounter of s.encounters.filter((e) => e.sourceEventId === id)) {
    encounter.status = "acknowledged";
    encounter.followUpPending = false;
  }
  return s;
}
