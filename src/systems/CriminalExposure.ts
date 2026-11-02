import { clamp, type GameState } from "../core/GameState";
import type { ZoneId } from "../core/GameState";
import { STREET_BALANCE as B } from "../content/street";
import { record } from "../core/EventLog";
export function exposure(s: GameState, id: string) {
  return (s.street.exposure[id] ??= {
    recent: [],
    investigation: 0,
    warningBand: 0,
  });
}
export function exposureScore(s: GameState, id: string, zone: ZoneId) {
  const c = s.characters[id],
    x = s.street.exposure[id];
  const history =
    x?.recent.reduce(
      (n, h) => n + h.weight * B.historyDecay ** (s.day - h.day),
      0,
    ) ?? 0;
  return clamp(
    c.police * 0.35 +
      c.notoriety * 0.1 +
      s.zones[zone].police * 0.15 +
      history * 0.55 +
      (x?.investigation ?? 0) * 0.3,
  );
}
export function addExposure(
  s: GameState,
  id: string,
  zone: ZoneId,
  weight = B.actionExposure,
) {
  const c = s.characters[id],
    x = exposure(s, id);
  x.recent.push({ day: s.day, zone, weight });
  x.recent = x.recent.filter((h) => s.day - h.day < B.historyDays).slice(-30);
  x.investigation = clamp(x.investigation + weight * 0.55);
  c.police = clamp(c.police + weight + s.zones[zone].police / 25);
  c.notoriety = clamp(c.notoriety + weight / 4);
  const band = Math.floor(exposureScore(s, id, zone) / 25);
  if (id === s.playerId && band > x.warningBand && band >= 2)
    record(
      s,
      "risk",
      band >= 3
        ? "You've been moving reckless lately. People are starting to notice."
        : "Word around the neighborhood is that police have been asking questions.",
      [id],
      [id],
      { importance: "major", title: "Scrutiny is building" },
    );
  x.warningBand = Math.max(x.warningBand, band);
}
export function decayExposure(s: GameState) {
  for (const x of Object.values(s.street.exposure)) {
    x.recent = x.recent.filter((h) => s.day - h.day < B.historyDays);
    x.investigation *= B.investigationDecay;
    // Warnings may recur only after a genuine recovery, not one lawful action.
    if (x.investigation < 8 && !x.recent.length) x.warningBand = 0;
  }
}
export const heatDescription = (n: number) =>
  n < 20 ? "Quiet" : n < 45 ? "Noticed" : n < 70 ? "Watched" : "Heavy scrutiny";
