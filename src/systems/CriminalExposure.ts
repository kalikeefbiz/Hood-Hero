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
    c.police * B.policeWeight +
      c.notoriety * B.notorietyWeight +
      s.zones[zone].police * B.neighborhoodWeight +
      history * B.historyWeight +
      (x?.investigation ?? 0) * B.investigationWeight,
  );
}
export function addExposure(
  s: GameState,
  id: string,
  zone: ZoneId,
  weight = B.actionExposure,
  significant = weight >= B.significantExposure,
) {
  if (id === s.playerId) s.strategic.lastCrimeDay = s.day;
  const c = s.characters[id],
    x = exposure(s, id);
  x.recent.push({ day: s.day, zone, weight });
  x.recent = x.recent.filter((h) => s.day - h.day < B.historyDays).slice(-30);
  if (significant)
    x.investigation = clamp(x.investigation + weight * B.investigationGain);
  c.police = clamp(c.police + weight * (0.8 + s.zones[zone].police / 150));
  c.notoriety = clamp(c.notoriety + weight / 6);
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

// Baseline police risk belongs to the attempted transaction, not to lawful days.
export function transactionArrestChance(
  s: GameState,
  id: string,
  zone: ZoneId,
) {
  const scrutiny = exposureScore(s, id, zone) / 100;
  return Math.min(
    B.maxTransactionArrest,
    B.baselineArrestChance + scrutiny * scrutiny * B.transactionArrestScale,
  );
}
export function ongoingArrestChance(s: GameState, id: string) {
  const c = s.characters[id],
    x = s.street.exposure[id];
  if (!x || (!x.recent.length && x.investigation < 5)) return 0;
  return Math.min(
    B.maxArrestChance,
    Math.max(0, (exposureScore(s, id, c.home) - B.arrestThreshold) / 220),
  );
}
