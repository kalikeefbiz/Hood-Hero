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
  for (const c of chars) {
    c.connections = c.known.filter(
      (id) =>
        c.id !== s.playerId ||
        ["mega", "flacco"].includes(id) ||
        id.startsWith("resident-") ||
        id.startsWith("contact-"),
    );
  }
  // Cordial awareness of Mega's established name is not friendship or player protection.
  const q = s.characters.quanny;
  if (q) {
    if (!q.known.includes("mega")) q.known.push("mega");
    q.relationships.mega = {
      trust: 10,
      respect: 35,
      affection: 0,
      grievance: 0,
      history: [],
    };
    // The authored introduction, not shared home or membership, establishes personal recognition.
    q.known = q.known.filter((id) => id !== s.playerId);
    q.connections = q.connections.filter((id) => id !== s.playerId);
    s.characters[s.playerId].known = s.characters[s.playerId].known.filter(
      (id) => id !== "quanny",
    );
    s.characters[s.playerId].connections = s.characters[
      s.playerId
    ].connections.filter((id) => id !== "quanny");
  }
  const p = s.characters[s.playerId];
  for (const c of chars)
    if (c.id !== p.id && !p.connections.includes(c.id))
      c.connections = c.connections.filter((id) => id !== p.id);
}

// Awareness is not a means of contact. Trust remains directional and independent.
export function connect(s: GameState, actor: string, target: string) {
  for (const [a, b] of [
    [actor, target],
    [target, actor],
  ]) {
    const c = s.characters[a];
    relationship(c, b);
    if (!c.known.includes(b)) c.known.push(b);
    if (!c.connections.includes(b)) c.connections.push(b);
  }
}
export function accessStatus(s: GameState, actor: string, target: string) {
  const c = s.characters[actor],
    n = s.characters[target];
  if (!c?.known.includes(target)) return "Unknown";
  if (!c.connections.includes(target)) return "Known of";
  return (n?.relationships[actor]?.trust ?? 0) >= 35 &&
    (n?.relationships[actor]?.grievance ?? 0) < 40
    ? "Trusted"
    : "Connected";
}
export function contactError(
  s: GameState,
  actor: string,
  target: string,
): string | null {
  const c = s.characters[actor],
    n = s.characters[target];
  if (!n || !c?.known.includes(target))
    return "You need to learn who this person is first.";
  if (!c.connections.includes(target))
    return "Known of, not connected. Ask an established contact for an introduction.";
  if (n.status !== "active") return `This person is unavailable (${n.status}).`;
  if (n.availableDay > s.day)
    return `Committed until day ${n.availableDay}. Use the member conversation to review commitments.`;
  if (
    (n.relationships[actor]?.trust ?? 0) < -10 ||
    (n.relationships[actor]?.grievance ?? 0) > 55
  )
    return "They aren't willing to talk. Your relationship needs repair.";
  return null;
}
export function introductionCandidates(
  s: GameState,
  actor: string,
  sponsor: string,
) {
  const c = s.characters[actor],
    n = s.characters[sponsor];
  if (!n || contactError(s, actor, sponsor)) return [];
  return n.connections.filter((id) => {
    const x = s.characters[id];
    const leader = Object.values(s.factions).some((f) =>
      f.leaders.includes(id),
    );
    return (
      id !== actor &&
      x?.status === "active" &&
      !c.connections.includes(id) &&
      (!leader ||
        (n.affiliation === x.affiliation &&
          (n.relationships[actor]?.trust ?? 0) >= 35))
    );
  });
}
