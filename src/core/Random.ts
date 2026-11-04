import type { GameState } from "./GameState";
export function random(s: Pick<GameState, "rng">): number {
  let t = (s.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  s.rng = s.rng >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
