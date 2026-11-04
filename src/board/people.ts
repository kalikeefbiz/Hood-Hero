import { quannyLocation, QUANNY_HOME } from "../systems/QuannyState";
import { player, type GameState } from "../core/GameState";
import { THEMES } from "../ui/theme";
import { LOCATIONS } from "./locations";
import { ZONE_ORDER } from "../city3d/layout";

export interface BoardPerson {
  id: string;
  name: string;
  placeId: string;
  slot: number;
  color: string;
  known: boolean;
}

// Characters stand where their district gathers (places with `people` links).
// Presentation only: when NPC schedules exist, replace this with their real
// whereabouts and keep the BoardPerson shape.
export function boardPeople(s: GameState): BoardPerson[] {
  const p = player(s);
  const out: BoardPerson[] = [];
  for (const zone of ZONE_ORDER) {
    const spots = LOCATIONS.filter((l) => l.zone === zone && l.links.people);
    if (!spots.length) continue;
    const residents = Object.values(s.characters)
      .filter((c) => c.id !== p.id && c.home === zone && c.status === "active")
      .sort(
        (a, b) =>
          Number(p.known.includes(b.id)) - Number(p.known.includes(a.id)) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 8);
    const used = new Map<string, number>();
    residents.forEach((c, i) => {
      const place =
        LOCATIONS.find(
          (l) =>
            l.id ===
            (c.id === "quanny"
              ? quannyLocation(s)
              : c.id === "mr-lewis"
                ? QUANNY_HOME
                : ""),
        ) ?? spots[i % spots.length];
      const slot = used.get(place.id) ?? 0;
      used.set(place.id, slot + 1);
      out.push({
        id: c.id,
        name: c.alias ?? c.name,
        placeId: place.id,
        slot,
        color: c.affiliation ? THEMES[c.affiliation].accent : "#c9c4b8",
        known: p.known.includes(c.id),
      });
    });
  }
  return out;
}
