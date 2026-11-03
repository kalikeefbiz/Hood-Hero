import {
  player,
  type FactionId,
  type GameState,
  type ZoneId,
} from "../core/GameState";
import { THEMES } from "../ui/theme";
import type { EffectKind } from "../systems/StrategicTypes";
import { ZONE_ORDER } from "./layout";

// A read-only projection of saved game state for the 3D city. The renderer
// only ever sees this view, so inspecting the city cannot change the save.
export interface FactionPresence {
  faction: FactionId;
  name: string;
  color: string;
  presence: number;
  /** Share of the visible territory overlay, 0..1. */
  share: number;
}
export interface ZoneView {
  id: ZoneId;
  name: string;
  subtitle: string;
  controller: FactionId | null;
  controllerColor: string;
  presence: FactionPresence[];
  contested: boolean;
  police: number;
  support: number;
  commerce: number;
  standing: number;
  isHome: boolean;
  /** 0..100: how busy the corner economy looks. Abstract, never procedural. */
  streetActivity: number;
  lawfulEconomy: number;
  recent: { kind: EffectKind; tone: "calm" | "tension" }[];
  description: string;
}
export interface CityView {
  day: number;
  playerAccent: string;
  zones: Record<ZoneId, ZoneView>;
  playerArrested: boolean;
}

const UNCLAIMED = "#A8ADB3";
const TENSION: EffectKind[] = ["challenge", "disruption", "reputation-loss"];

export function deriveCityView(s: GameState): CityView {
  const p = player(s);
  const zones = {} as Record<ZoneId, ZoneView>;
  for (const id of ZONE_ORDER) {
    const z = s.zones[id],
      t = s.strategic.territories[id];
    const footholds = (Object.keys(t.factions) as FactionId[])
      .map((f) => ({ f, q: t.factions[f] }))
      .filter(({ f, q }) => z.organizations.includes(f) || q.presence >= 15);
    const total = footholds.reduce((n, { q }) => n + q.presence, 0) || 1;
    const presence = footholds
      .sort((a, b) => b.q.presence - a.q.presence)
      .map(({ f, q }) => ({
        faction: f,
        name: s.factions[f].name,
        color: THEMES[f].accent,
        presence: q.presence,
        share: q.presence / total,
      }));
    const market = s.street.markets[id];
    zones[id] = {
      id,
      name: z.name,
      subtitle: z.subtitle,
      controller: z.controller,
      controllerColor: z.controller ? THEMES[z.controller].accent : UNCLAIMED,
      presence,
      contested: t.contested,
      police: z.police,
      support: z.support,
      commerce: z.commerce,
      standing: p.neighborhoodStanding[id],
      isHome: p.home === id,
      streetActivity: market ? Math.max(0, Math.min(100, market.activity)) : 0,
      lawfulEconomy: t.lawfulEconomy,
      recent: s.strategic.effects
        .filter((e) => e.zone === id && e.day >= s.day - 2)
        .slice(-4)
        .map((e) => ({
          kind: e.kind,
          tone: TENSION.includes(e.kind) ? "tension" : "calm",
        })),
      description: z.description,
    };
  }
  return {
    day: s.day,
    playerAccent: THEMES[p.affiliation ?? "independent"].secondary,
    zones,
    playerArrested: p.status === "arrested",
  };
}

/** Accessible one-line summary shared by the 3D chips and the 2D map. */
export function zoneDescription(s: GameState, id: ZoneId) {
  const z = s.zones[id];
  const presence = z.organizations.map((f) => s.factions[f].name).join(" / ");
  return `${z.controller ? `Controlled by ${s.factions[z.controller].name}.` : "No single controller."}${presence ? ` Faction presence: ${presence}.` : " Unclaimed."}`;
}
