import { advanceBusinesses } from "../systems/Businesses";
import { resolveTerritories } from "../systems/Territory";
import { legitimateProgress, finalizeEnding } from "../systems/EndConditions";
import { advanceStreet } from "../systems/StreetEconomy";
import { releaseEligible } from "../systems/Incarceration";
import { processCrewActivities } from "../systems/CrewAgency";
import { cash, clamp, player, type GameState } from "./GameState";
import { record } from "./EventLog";
import { BALANCE } from "../content/balance";
import { earn, expense } from "../systems/Economy";
import { evaluatePromises } from "../systems/Commitments";
import { syncEncounters } from "../systems/EncounterLifecycle";
import { advanceNPCs } from "../systems/NPCDecisionAI";
import { advanceFactions } from "../systems/Factions";
import { advanceIncidents } from "../systems/Incidents";
import { advancePressure } from "../systems/Reputation";
import { progress } from "../systems/Progression";

import { settleAttendance, generateShifts } from "../systems/Employment";
import { settleWorkplaceScenes } from "../systems/Workplace";
export function advanceDay(state: GameState): GameState {
  if (state.end) return state;
  const s = structuredClone(state);
  settleWorkplaceScenes(s);
  settleAttendance(s);
  s.day++;
  releaseEligible(s);
  advanceStreet(s);
  generateShifts(s);
  processCrewActivities(s);
  advanceNPCs(s);
  advanceFactions(s);
  resolveTerritories(s);
  advanceBusinesses(s);
  advanceIncidents(s);
  evaluatePromises(s);
  advancePressure(s);
  const p = player(s),
    income =
      p.recurringLawfulIncome +
      s.assets
        .filter(
          (a) =>
            a.owner === p.id &&
            a.provenance === "clean" &&
            !s.strategic.businesses.some((b) => b.id === a.id),
        )
        .reduce((n, a) => n + a.recurringIncome, 0);
  if (income) earn(s, p, income, "clean", "Recurring lawful income");
  const paid = Math.min(BALANCE.livingCost, cash(p));
  expense(s, p, paid, "Daily living expenses");
  if (paid < BALANCE.livingCost) {
    s.street.arrears += BALANCE.livingCost - paid;
    p.stress = clamp(p.stress + 7);
    record(
      s,
      "money",
      `You could cover only $${paid} of today’s $${BALANCE.livingCost} living costs. Stress increased; work remains available.`,
      [p.id],
    );
  } else
    record(
      s,
      "money",
      `$${paid} covered today’s basic living costs.`,
      [p.id],
      [p.id],
      { importance: "routine" },
    );
  progress(s);
  s.strategic.lawfulStreak =
    legitimateProgress(s).income >= BALANCE.recurringIncomeVictory &&
    !legitimateProgress(s).recentCrime &&
    p.wallet.illicit === 0
      ? s.strategic.lawfulStreak + 1
      : 0;
  finalizeEnding(s);
  s.ap = BALANCE.dailyAP;
  record(
    s,
    "system",
    `Day ${s.day}. Two action points available.`,
    [p.id],
    [p.id],
    { importance: "routine" },
  );
  syncEncounters(s);
  return s;
}

export function serveSentence(state: GameState): GameState {
  const r = state.street.custody.find(
    (r) =>
      r.character === state.playerId &&
      r.status === "held" &&
      r.releaseDay !== null,
  );
  if (!r || state.end) return state;
  let s = state;
  const releaseDay = r.releaseDay!;
  while (s.day < releaseDay && !s.end) s = advanceDay(s);
  return s;
}
