import type { GameState, GameEvent, ID } from "./GameState";
export function record(
  s: GameState,
  category: GameEvent["category"],
  text: string,
  actors: ID[] = [],
  observers: ID[] = actors,
  details: Partial<
    Pick<
      GameEvent,
      | "importance"
      | "title"
      | "incidentId"
      | "commitmentId"
      | "factionId"
      | "presentationKey"
      | "expiresOnIncidentClose"
    >
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

// Several factual records may describe one outcome. Keep all records, present one notice.
export function importantEvents(s: GameState) {
  const groups = new Map<string, GameEvent>();
  for (const e of visibleEvents(s).filter(
    (e) => e.importance === "major" || e.importance === "critical",
  )) {
    const key = e.presentationKey ?? e.id,
      previous = groups.get(key);
    if (
      !previous ||
      e.importance === "critical" ||
      previous.importance !== "critical"
    )
      groups.set(key, e);
  }
  return [...groups.values()];
}
export const expiredNotice = (s: GameState, e: GameEvent) =>
  !!(
    e.expiresOnIncidentClose &&
    e.incidentId &&
    s.incidents[e.incidentId]?.status !== "active"
  );
export const unseenEvents = (s: GameState) =>
  importantEvents(s).filter(
    (e) => !expiredNotice(s, e) && !s.acknowledgedEvents.includes(e.id),
  );
export function acknowledgeEvent(state: GameState, id: ID): GameState {
  const event = visibleEvents(state).find((e) => e.id === id);
  if (!event) return state;
  const s = structuredClone(state);
  const ids = new Set(
    visibleEvents(s)
      .filter(
        (e) =>
          e.id === id ||
          (event.presentationKey &&
            e.presentationKey === event.presentationKey),
      )
      .map((e) => e.id),
  );
  s.acknowledgedEvents = [...new Set([...s.acknowledgedEvents, ...ids])];
  for (const encounter of s.encounters.filter(
    (e) => e.sourceEventId && ids.has(e.sourceEventId),
  )) {
    encounter.status = "acknowledged";
    encounter.followUpPending = false;
  }
  return s;
}
