import type { GameState, GameEvent, ID } from "./GameState";
export function record(
  s: GameState,
  category: GameEvent["category"],
  text: string,
  actors: ID[] = [],
  observers: ID[] = actors,
): GameEvent {
  const event = {
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
