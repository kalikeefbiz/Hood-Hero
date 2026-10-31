import { clamp, type GameState } from "../core/GameState";
import { record } from "../core/EventLog";
import { earn } from "./Economy";
import { change, remember } from "./Relationships";
import { BALANCE } from "../content/balance";
export function processCommitments(s: GameState) {
  for (const o of s.commitments.filter(
    (o) => o.status === "pending" && o.dueDay <= s.day,
  )) {
    const c = s.characters[o.actor],
      b = s.characters[o.beneficiary];
    if (c.status !== "active" || (c.relationships[b.id]?.trust ?? 0) < 20) {
      o.status = "failed";
      const e = record(s, "crew", `${c.name} could not complete the errand.`, [
        c.id,
        b.id,
      ]);
      remember(s, b.id, c.id, e.id, "An obligation fell through.", -5);
      continue;
    }
    o.status = "completed";
    earn(s, b, BALANCE.errandIncome, "clean", `Errand by ${c.name}`);
    c.wallet.clean += 12;
    c.skills.work = clamp(c.skills.work + 3);
    change(c, b.id, { trust: 3, respect: 2 });
    const e = record(
      s,
      "crew",
      `${c.name} completed the errand: $${BALANCE.errandIncome} clean income for you and $12 for them.`,
      [c.id, b.id],
    );
    remember(s, c.id, b.id, e.id, "We completed paid work together.", 10);
    remember(s, b.id, c.id, e.id, "Kept a work commitment.", 8);
  }
}

// Cooperation follows actual ties and loyalties, never a neighborhood penalty.
export function recoverySupport(
  s: GameState,
  actor: string,
  opposingOrganization: string,
): number {
  if (actor !== s.playerId) return 0;
  const available = s.crew.members
    .map((id) => s.characters[id])
    .filter(
      (c) =>
        c.status === "active" &&
        c.availableDay <= s.day &&
        (c.relationships[actor]?.trust ?? 0) >= 20,
    );
  return available.reduce((bonus, c) => {
    if (c.affiliation === opposingOrganization && c.traits.loyalty >= 50)
      return bonus;
    const conflict = available.some(
      (other) =>
        other.id !== c.id &&
        ((c.relationships[other.id]?.grievance ?? 0) > 35 ||
          !!(
            c.affiliation &&
            other.affiliation &&
            s.factions[c.affiliation].enemies.includes(other.affiliation)
          )),
    );
    return bonus + (c.skills.recovery / 1000) * (conflict ? 0.5 : 1);
  }, 0);
}
