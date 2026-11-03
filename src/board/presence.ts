import {
  player,
  type FactionId,
  type GameState,
  type ZoneId,
} from "../core/GameState";
import { LOCATIONS, locationById } from "./locations";
import { deriveBlocks } from "./blocks";
import { locationBlock } from "../city3d/layout";

// ---------------------------------------------------------------------------
// PLAYER PRESENCE: the player is a physical character in Stixx City.
//
// Where they stand is saved with the game (`GameState.presence`), so later
// systems can ask "where is the player, and what risk do they face there?".
// Movement has no AP or travel cost yet; encounter systems hook in through
// `onArrival` without touching the board. See docs/STRATEGY_BOARD.md.
// ---------------------------------------------------------------------------

export const HAIR = [
  "fade",
  "afro",
  "braids",
  "locs",
  "waves",
  "cap",
  "bald",
] as const;
export const TOPS = ["hoodie", "tee", "jacket", "tank", "jersey"] as const;
export const BUILDS = ["slim", "average", "broad"] as const;
export interface Appearance {
  skin: string;
  hair: (typeof HAIR)[number];
  hairColor: string;
  top: (typeof TOPS)[number];
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  chain: boolean;
  build: (typeof BUILDS)[number];
  /** Future: a GLB from the character creator replaces the procedural figure. */
  model?: string;
}
export interface Presence {
  /** Location registry id where the player currently stands. */
  location: string;
  zone: ZoneId;
  arrivedDay: number;
  /** Most recent stops, newest last (capped). */
  trail: { location: string; day: number }[];
  appearance: Appearance;
}

export const SKIN_TONES = [
  "#f1c9a5",
  "#d9a77c",
  "#b97e55",
  "#8d5a3b",
  "#6b4029",
  "#4a2b1c",
];
export const DEFAULT_APPEARANCE: Appearance = {
  skin: "#8d5a3b",
  hair: "fade",
  hairColor: "#1c1612",
  top: "hoodie",
  topColor: "#2b2f36",
  bottomColor: "#3a4a6a",
  shoeColor: "#f2f2f2",
  chain: false,
  build: "average",
};

/** Home base: the first restable place in the player's home district. */
export function homeBase(s: GameState) {
  const home = player(s).home;
  return (
    LOCATIONS.find((l) => l.zone === home && l.links.rest) ??
    LOCATIONS.find((l) => l.zone === home)!
  ).id;
}
/** Presence for any save; older saves start at home. */
export function presenceOf(s: GameState): Presence {
  if (s.presence && locationById(s.presence.location)) return s.presence;
  const location = homeBase(s);
  return {
    location,
    zone: locationById(location)!.zone,
    arrivedDay: s.day,
    trail: [],
    appearance: { ...DEFAULT_APPEARANCE },
  };
}

export type ArrivalHook = (
  s: GameState,
  location: string,
  risk: Risk,
) => GameState;
const arrivalHooks: ArrivalHook[] = [];
/**
 * Register a system that reacts to the player arriving somewhere (ambushes,
 * police stops, run-ins). Hooks receive the state after the move and return
 * the next state. None are registered in this environment pass.
 */
export function onArrival(hook: ArrivalHook) {
  arrivalHooks.push(hook);
  return () => arrivalHooks.splice(arrivalHooks.indexOf(hook), 1);
}

/** Move the player to a place. Pure: returns a new state. */
export function moveTo(s: GameState, location: string): GameState {
  const l = locationById(location);
  if (!l) return s;
  const prev = presenceOf(s);
  if (prev.location === location)
    return s.presence ? s : { ...s, presence: prev };
  const next: GameState = {
    ...s,
    presence: {
      ...prev,
      location,
      zone: l.zone,
      arrivedDay: s.day,
      trail: [
        ...prev.trail,
        { location: prev.location, day: prev.arrivedDay },
      ].slice(-12),
    },
  };
  const risk = assessRisk(next, location);
  return arrivalHooks.reduce(
    (state, hook) => hook(state, location, risk),
    next,
  );
}
export function setAppearance(s: GameState, appearance: Appearance): GameState {
  return { ...s, presence: { ...presenceOf(s), appearance } };
}

export interface Risk {
  level: "safe" | "watchful" | "tense" | "hostile";
  score: number;
  /** Plain-language reasons, most important first. */
  reasons: string[];
  turf: FactionId | null;
}
/**
 * How exposed the player is at a place, from data the game already tracks:
 * whose marks are on the block versus the player's affiliation, contested
 * ground, police presence against the player's heat, and notoriety.
 * Informational only for now — encounter systems decide what it triggers.
 */
export function assessRisk(s: GameState, location: string): Risk {
  const l = locationById(location);
  const p = player(s);
  if (!l) return { level: "safe", score: 0, reasons: [], turf: null };
  const block = locationBlock(l);
  const bv = block ? deriveBlocks(s)[block.id] : null;
  const turf = l.faction ?? bv?.faction ?? null;
  const reasons: { w: number; text: string }[] = [];
  if (turf) {
    const mine = p.affiliation === turf;
    const enemy =
      p.affiliation && s.factions[p.affiliation].enemies.includes(turf);
    if (mine) reasons.push({ w: -15, text: `Your own people hold this turf.` });
    else if (enemy)
      reasons.push({
        w: 45,
        text: `${s.factions[turf].name} turf — they're at war with yours.`,
      });
    else if (p.affiliation)
      reasons.push({
        w: 20,
        text: `${s.factions[turf].name} turf, and you wear another set's name.`,
      });
    else
      reasons.push({
        w: 8,
        text: `${s.factions[turf].name} turf. Independents are watched, not targeted.`,
      });
  }
  if (bv?.contested)
    reasons.push({ w: 18, text: "Contested ground — rivals are pushing in." });
  const police = s.zones[l.zone].police;
  const heat = (police / 100) * p.police;
  if (heat > 12)
    reasons.push({
      w: heat * 0.6,
      text: `Heavy police presence and your heat (${Math.round(p.police)}) don't mix.`,
    });
  else if (police >= 70)
    reasons.push({ w: 6, text: "Police are everywhere here." });
  if (p.notoriety > 40)
    reasons.push({ w: p.notoriety * 0.2, text: "People recognize you." });
  if (p.home === l.zone)
    reasons.push({ w: -8, text: "Home turf: you know these streets." });
  const score = Math.max(0, Math.round(reasons.reduce((n, r) => n + r.w, 0)));
  return {
    level:
      score >= 45
        ? "hostile"
        : score >= 25
          ? "tense"
          : score >= 8
            ? "watchful"
            : "safe",
    score,
    reasons: reasons
      .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
      .map((r) => r.text),
    turf,
  };
}
