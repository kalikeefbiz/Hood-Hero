import {
  clamp,
  type Character,
  type GameState,
  type Relationship,
} from "../core/GameState";
export function relationship(c: Character, id: string): Relationship {
  return (c.relationships[id] ??= {
    trust: 10,
    respect: 10,
    affection: 0,
    grievance: 0,
    history: [],
  });
}
export function remember(
  s: GameState,
  who: string,
  about: string,
  eventId: string,
  meaning: string,
  weight: number,
) {
  const c = s.characters[who];
  if (!c) return;
  c.memories.push({ eventId, day: s.day, about, meaning, weight });
  relationship(c, about).history.push(eventId);
  if (!c.known.includes(about)) c.known.push(about);
}
export function change(
  c: Character,
  id: string,
  values: Partial<
    Pick<Relationship, "trust" | "respect" | "affection" | "grievance">
  >,
) {
  const r = relationship(c, id);
  for (const key of Object.keys(values) as (keyof typeof values)[])
    r[key] = clamp(
      r[key] + (values[key] ?? 0),
      key === "grievance" ? 0 : -100,
      100,
    );
}
export function initializeRelationships(s: GameState) {
  const chars = Object.values(s.characters);
  for (const a of chars)
    for (const b of chars) {
      if (a.id === b.id) continue;
      if (a.affiliation && a.affiliation === b.affiliation) {
        change(a, b.id, {
          trust: 18 + a.traits.loyalty / 10,
          respect: b.influence / 5,
        });
        a.known.push(b.id);
      } else if (a.home === b.home) {
        change(a, b.id, { trust: 8 });
        a.known.push(b.id);
      } else if (
        a.affiliation &&
        b.affiliation &&
        s.factions[a.affiliation].enemies.includes(b.affiliation)
      )
        change(a, b.id, { trust: -20, grievance: 15 });
    }
  for (const [a, b] of [
    ["player", "mega"],
    ["mega", "player"],
    ["player", "flacco"],
    ["flacco", "player"],
  ]) {
    change(s.characters[a], b, {
      trust: a === "player" ? 50 : 60,
      affection: 65,
      respect: 25,
    });
    if (!s.characters[a].known.includes(b)) s.characters[a].known.push(b);
  }
}
