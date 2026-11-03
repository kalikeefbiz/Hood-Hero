import type { FactionId, ZoneId } from "../core/GameState";
export const EFFECT_KINDS = [
  "economic",
  "community",
  "support",
  "challenge",
  "defense",
  "reputation-loss",
  "disruption",
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];
export interface InfluenceEffect {
  actor: string;
  participants?: string[];
  faction: FactionId | null;
  zone: ZoneId;
  kind: EffectKind;
  magnitude: number;
  cause: string;
}
export interface Foothold {
  presence: number;
  influence: number;
  economy: number;
  support: number;
  pressure: number;
}
export interface Territory {
  factions: Record<FactionId, Foothold>;
  controller: FactionId | null;
  contested: boolean;
  candidate: FactionId | null;
  candidateDays: number;
  weakDays: number;
  lastResolvedDay: number;
  controlSince: number;
  lawfulEconomy: number;
  changes: {
    day: number;
    from: FactionId | null;
    to: FactionId | null;
    eventId: string;
  }[];
}
export type DecisionKind =
  "maintain" | "expand" | "contest" | "recover" | "economy";
export interface Strategy {
  nextDecisionDay: number;
  lastDecision: DecisionKind | null;
  target: ZoneId;
  priority: ZoneId | null;
  priorityUntil: number;
  history: {
    day: number;
    kind: DecisionKind;
    zone: ZoneId;
    cost: number;
    eventId: string;
  }[];
}
export interface Business {
  id: string;
  definition: string;
  acquiredDay: number;
  lastOperatingDay: number;
  status: "operating" | "profitable" | "struggling" | "sold" | "closed";
  provenance: "clean" | "illicit";
  condition: number;
  lastNet: number;
  totalNet: number;
  profitableDays: number;
  history: { day: number; revenue: number; expenses: number; net: number }[];
}
export interface StrategicState {
  territories: Record<ZoneId, Territory>;
  strategies: Record<FactionId, Strategy>;
  effects: (InfluenceEffect & { day: number; eventId: string })[];
  contributions: Record<FactionId, number>;
  membershipDay: number | null;
  lastActionDay: number;
  lastPromotionDay: number;
  businesses: Business[];
  lawfulStreak: number;
  lastCrimeDay: number | null;
  ending: {
    day: number;
    kind: "legitimate-exit" | "underlord" | "killed";
    eventId: string;
  } | null;
}
