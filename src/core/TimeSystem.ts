import { cash, clamp, player, type GameState } from "./GameState";
import { record } from "./EventLog";
import { BALANCE } from "../content/balance";
import { earn, expense } from "../systems/Economy";
import { processCommitments } from "../systems/Crew";
import { advanceNPCs } from "../systems/NPCDecisionAI";
import { advanceFactions } from "../systems/Factions";
import { advanceIncidents } from "../systems/Incidents";
import { advancePressure } from "../systems/Reputation";
import { progress } from "../systems/Progression";
import { evaluateEnd } from "../systems/EndConditions";
export function advanceDay(state: GameState): GameState {
  if (state.end) return state;
  const s = structuredClone(state);
  s.day++;
  processCommitments(s);
  advanceNPCs(s);
  advanceFactions(s);
  advanceIncidents(s);
  advancePressure(s);
  const p = player(s),
    income =
      p.recurringLawfulIncome +
      s.assets
        .filter((a) => a.owner === p.id && a.provenance === "clean")
        .reduce((n, a) => n + a.recurringIncome, 0);
  if (income) earn(s, p, income, "clean", "Recurring lawful income");
  const paid = Math.min(BALANCE.livingCost, cash(p));
  expense(s, p, paid, "Daily living expenses");
  if (paid < BALANCE.livingCost) {
    p.stress = clamp(p.stress + 7);
    record(
      s,
      "money",
      `You could cover only $${paid} of today’s $${BALANCE.livingCost} living costs. Stress increased; work remains available.`,
      [p.id],
    );
  } else
    record(s, "money", `$${paid} covered today’s basic living costs.`, [p.id]);
  progress(s);
  s.end = evaluateEnd(s);
  s.ap = BALANCE.dailyAP;
  record(s, "system", `Day ${s.day}. Two action points available.`, [p.id]);
  return s;
}
