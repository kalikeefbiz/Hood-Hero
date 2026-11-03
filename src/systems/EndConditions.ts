import { type GameState, player } from "../core/GameState";
import { BALANCE } from "../content/balance";
import { STRATEGY_BALANCE as B } from "../content/strategy";
import { stabilizedControl } from "./Territory";
import { successorError } from "./Politics";
import { record } from "../core/EventLog";
export function legitimateProgress(s: GameState) {
  const p = player(s),
    lawful = s.assets.filter(
      (a) => a.owner === p.id && a.provenance === "clean",
    );
  const debt =
    s.street.arrears +
    s.street.agreements
      .filter((a) => a.debtor === p.id)
      .reduce((n, a) => n + a.balance, 0);
  const wealth =
    p.wallet.clean + lawful.reduce((n, a) => n + a.value, 0) - debt;
  const income =
    p.recurringLawfulIncome + lawful.reduce((n, a) => n + a.recurringIncome, 0);
  const recentCrime =
    (s.strategic.lastCrimeDay !== null &&
      s.day - s.strategic.lastCrimeDay < BALANCE.legitimateCooldownDays) ||
    s.ledger.some(
      (e) =>
        e.provenance === "illicit" &&
        e.amount > 0 &&
        s.day - e.day < BALANCE.legitimateCooldownDays,
    );
  const missing: string[] = [];
  if (wealth < BALANCE.cleanWealthVictory)
    missing.push(
      `$${BALANCE.cleanWealthVictory.toLocaleString()} qualifying net clean wealth`,
    );
  if (income < BALANCE.recurringIncomeVictory)
    missing.push(
      `$${BALANCE.recurringIncomeVictory}/day net recurring lawful income`,
    );
  if (s.strategic.lawfulStreak < B.lawfulSustainDays)
    missing.push(
      `${B.lawfulSustainDays} consecutive days of sustainable lawful income`,
    );
  if (
    p.wallet.illicit > 0 ||
    s.strategic.businesses.some(
      (b) =>
        b.provenance === "illicit" && !["sold", "closed"].includes(b.status),
    )
  )
    missing.push("No illicit cash or operating illicit-funded business");
  if (s.street.lots.some((l) => l.owner === p.id && l.remaining > 0))
    missing.push("No merchandise remaining in distribution");
  if (recentCrime)
    missing.push(
      `${BALANCE.legitimateCooldownDays} days since criminal activity or illicit earnings`,
    );
  if (debt > 0)
    missing.push("Clear outstanding supplier obligations and living arrears");
  if (p.status !== "active") missing.push("Be active and available to retire");
  return { wealth, income, debt, recentCrime, missing };
}
export function evaluateEnd(s: GameState): GameState["end"] {
  const p = player(s);
  if (p.status === "dead") return "killed";
  if (s.progression.retired && !legitimateProgress(s).missing.length)
    return "legitimate-exit";
  if (
    p.affiliation &&
    p.authority >= BALANCE.underlordAuthority &&
    stabilizedControl(s, p.affiliation) >= BALANCE.underlordZones &&
    s.crew.successor &&
    !successorError(s, s.crew.successor)
  )
    return "underlord";
  return null;
}
export function finalizeEnding(s: GameState) {
  if (s.strategic.ending) return;
  const ending = evaluateEnd(s);
  s.end = ending;
  if (!ending || ending === "arrested") return;
  const p = player(s),
    text =
      ending === "underlord"
        ? `${p.name} secured recognized power through ${s.factions[p.affiliation!].name}, with ${s.characters[s.crew.successor!].name} ready to carry the position forward. The city's record of your rise remains.`
        : ending === "legitimate-exit"
          ? `${p.name} chose to leave the streets behind. Proven lawful income and clean assets support an independent life; the record of how you got here remains.`
          : `${p.name}'s life ended. Stixx City keeps its memory.`;
  const e = record(s, "system", text, [p.id], [p.id], {
    title: ending === "killed" ? "Campaign ended" : "A life established",
    importance: "critical",
  });
  s.strategic.ending = { day: s.day, kind: ending, eventId: e.id };
}
export function retire(state: GameState) {
  const missing = legitimateProgress(state).missing;
  if (state.end || missing.length)
    return { state, error: missing.join("; ") || "Campaign ended" };
  const s = structuredClone(state);
  s.progression.retired = true;
  finalizeEnding(s);
  return { state: s, error: null };
}
