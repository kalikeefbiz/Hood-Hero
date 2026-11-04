import { advanceQuanny } from "../systems/Quanny";
import {
  advanceConflicts,
  dischargePatient,
  expose,
  hospitalStay,
} from "../systems/Danger";
import { presenceOf } from "../board/presence";
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
  advanceConflicts(s);
  advanceQuanny(s);
  for (const i of s.danger.injuries)
    if (i.severity === "minor" && s.day >= i.releaseDay) i.discharged = true;
  for (const c of Object.values(s.characters))
    if (
      c.id !== s.playerId &&
      c.status === "laying-low" &&
      c.availableDay <= s.day
    )
      c.status = "active";
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
  expose(s, presenceOf(s).location, "linger");
  if (s.end) {
    syncEncounters(s);
    return s;
  }
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
  dischargePatient(s);
  s.ap =
    hospitalStay(s) || s.end
      ? 0
      : BALANCE.dailyAP -
        (s.danger.injuries.some((i) => !i.discharged && i.severity === "minor")
          ? 1
          : 0);
  record(
    s,
    "system",
    `Day ${s.day}. ${hospitalStay(s) ? "Inpatient recovery continues." : s.end ? "This life has ended." : `${s.ap} action points available.`}`,
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

/** All normal day systems run during treatment; no frozen NPC/faction timeline. */
export function recoverInHospital(state: GameState): GameState {
  const stay = hospitalStay(state);
  if (!stay || state.end) return state;
  let s = state;
  while (s.day < stay.releaseDay && !s.end) s = advanceDay(s);
  return s;
}
