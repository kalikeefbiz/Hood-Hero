import {
  cash,
  type Character,
  type GameState,
  type Wallet,
} from "../core/GameState";
export function spend(c: Character, amount: number): Wallet | null {
  if (!Number.isFinite(amount) || amount < 0 || cash(c) < amount) return null;
  const clean = Math.min(c.wallet.clean, amount),
    illicit = amount - clean;
  c.wallet.clean -= clean;
  c.wallet.illicit -= illicit;
  return { clean, illicit };
}
export function earn(
  s: GameState,
  c: Character,
  amount: number,
  provenance: "clean" | "illicit",
  reason: string,
) {
  c.wallet[provenance] += amount;
  if (c.id === s.playerId) {
    s.ledger.push({ day: s.day, amount, provenance, reason });
    s.progression[provenance === "clean" ? "cleanEarned" : "illicitEarned"] +=
      amount;
  }
}
export function expense(
  s: GameState,
  c: Character,
  amount: number,
  reason: string,
): Wallet | null {
  const paid = spend(c, amount);
  if (paid && c.id === s.playerId)
    for (const provenance of ["clean", "illicit"] as const)
      if (paid[provenance])
        s.ledger.push({
          day: s.day,
          amount: -paid[provenance],
          provenance,
          reason,
        });
  return paid;
}

// Repaying arrears is an actual expense, preserving the same clean-first provenance rules.
export function payArrears(state: GameState) {
  const p = state.characters[state.playerId],
    amount = state.street.arrears;
  if (state.end || p.status !== "active" || !amount || cash(p) < amount)
    return {
      state,
      error:
        "Requires available cash to clear all living and operating arrears",
    };
  const s = structuredClone(state);
  expense(s, s.characters[s.playerId], amount, "Arrears repaid");
  s.street.arrears = 0;
  return { state: s, error: null };
}
