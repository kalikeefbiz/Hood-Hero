import { type GameState } from "../core/GameState";
import { availability } from "./CrewAgency";
// Cooperation follows actual ties and loyalties, never a neighborhood penalty.
export function recoverySupport(
  s: GameState,
  actor: string,
  opposingOrganization: string,
): number {
  if (actor !== s.playerId) return 0;
  const available = s.crew.members
    .map((id) => s.characters[id])
    .filter(
      (c) =>
        c.status === "active" &&
        !availability(s, c) &&
        (c.relationships[actor]?.trust ?? 0) >= 20,
    );
  return available.reduce((bonus, c) => {
    if (c.affiliation === opposingOrganization && c.traits.loyalty >= 50)
      return bonus;
    const conflict = available.some(
      (other) =>
        other.id !== c.id &&
        ((c.relationships[other.id]?.grievance ?? 0) > 35 ||
          !!(
            c.affiliation &&
            other.affiliation &&
            s.factions[c.affiliation].enemies.includes(other.affiliation)
          )),
    );
    return bonus + (c.skills.recovery / 1000) * (conflict ? 0.5 : 1);
  }, 0);
}
