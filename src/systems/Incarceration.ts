import { clamp, type GameState } from "../core/GameState";
import { record } from "../core/EventLog";
import { STREET_BALANCE as B } from "../content/street";
export function arrest(s: GameState, id: string, cause: string, severity = 1) {
  const c = s.characters[id];
  if (!c || c.status !== "active") return;
  const prior = s.street.custody.filter((r) => r.character === id).length;
  const length = Math.min(
    B.maxSentence,
    B.minSentence + Math.min(2, prior) + Math.max(0, severity - 1),
  );
  c.status = "arrested";
  const e = record(
    s,
    "risk",
    `${c.name} was arrested: ${cause}. Release scheduled for day ${s.day + length}. Debts and daily costs continue.`,
    [id],
    id === s.playerId || s.crew.members.includes(id) ? [s.playerId, id] : [id],
    { importance: "critical", title: `${c.name} in custody` },
  );
  s.street.custody.push({
    id: `custody-${s.nextId++}`,
    character: id,
    arrestDay: s.day,
    cause,
    severity,
    prior,
    releaseDay: s.day + length,
    status: "held",
    conditions: "Residual police scrutiny; all outstanding obligations remain.",
    eventId: e.id,
  });
}
export function releaseEligible(s: GameState) {
  // Null dates explicitly represent canonical indefinite incarceration (Loco).
  for (const r of s.street.custody) {
    if (r.status !== "held" || r.releaseDay === null || s.day < r.releaseDay)
      continue;
    r.status = "released";
    const c = s.characters[r.character];
    if (c.status !== "arrested") continue;
    c.status = "active";
    c.police = clamp(Math.max(B.residualPolice, c.police * 0.5));
    record(
      s,
      "risk",
      `${c.name} was released. Unpaid balances, missed work and arrest history remain.`,
      [c.id],
      c.id === s.playerId || s.crew.members.includes(c.id)
        ? [s.playerId, c.id]
        : [c.id],
      { importance: "major", title: `${c.name} released` },
    );
  }
}
