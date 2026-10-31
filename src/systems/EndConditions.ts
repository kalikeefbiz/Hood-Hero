import { type GameState, player } from "../core/GameState";
import { BALANCE } from "../content/balance";
export function evaluateEnd(s: GameState): GameState["end"] {
  const p = player(s);
  if (p.status === "arrested") return "arrested";
  if (p.status === "dead") return "killed";
  const lawful = s.assets.filter(
    (a) => a.owner === p.id && a.provenance === "clean",
  );
  if (
    s.progression.retired &&
    p.wallet.clean + lawful.reduce((n, a) => n + a.value, 0) >=
      BALANCE.cleanWealthVictory &&
    p.recurringLawfulIncome +
      lawful.reduce((n, a) => n + a.recurringIncome, 0) >=
      BALANCE.recurringIncomeVictory &&
    !s.ledger.some(
      (e) =>
        e.provenance === "illicit" &&
        e.amount > 0 &&
        s.day - e.day < BALANCE.legitimateCooldownDays,
    ) &&
    p.wallet.illicit === 0
  )
    return "legitimate-exit";
  const heir = s.crew.successor && s.characters[s.crew.successor];
  if (
    p.affiliation &&
    s.factions[p.affiliation] &&
    p.authority >= BALANCE.underlordAuthority &&
    Object.values(s.zones).filter((z) => z.controller === p.affiliation)
      .length >= BALANCE.underlordZones &&
    heir &&
    heir.status === "active" &&
    heir.affiliation === p.affiliation &&
    s.crew.members.includes(heir.id) &&
    heir.relationships[p.id]?.trust >= 50
  )
    return "underlord";
  return null;
}
