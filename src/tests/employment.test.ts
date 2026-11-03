import { describe, expect, it } from "vitest";
import { newGame } from "../core/Simulation";
import { advanceDay } from "../core/TimeSystem";
import {
  performAction,
  validateAction,
  type Action,
} from "../core/ActionEngine";
import { player, cash, type GameState, type ZoneId } from "../core/GameState";
import {
  currentEmployment,
  shiftToday,
  nextShift,
  absenceWarning,
} from "../systems/Employment";
import {
  respondEncounter,
  syncEncounters,
  dismissEncounter,
} from "../systems/Encounters";
import { serialize, deserialize } from "../persistence/SaveSystem";
import { record } from "../core/EventLog";
import { BALANCE } from "../content/balance";
const action = (
  s: GameState,
  type: Action["type"],
  extra: Partial<Action> = {},
) => {
  const result = performAction(s, { type, actor: s.playerId, ...extra });
  expect(result.error, `${type} at day ${s.day}`).toBeNull();
  return result.state;
};
function hire(s: GameState, jobId = `retail-${player(s).home}`) {
  s = action(s, "apply", { jobId });
  return action(s, "acceptJob", { jobId });
}
function finishScenes(s: GameState, response = "skip") {
  const scene = s.encounters.find(
    (e) => e.definitionId === "workplace" && e.status === "active",
  );
  if (scene) {
    const r = respondEncounter(s, scene.id, response);
    expect(r.error).toBeNull();
    return r.state;
  }
  return s;
}
describe("employment commitments and survival", () => {
  it.each(["south", "downtown", "rio", "reservoir", "nawf"] as ZoneId[])(
    "hiring and save round trip from %s",
    (home) => {
      let s = newGame("Worker", home);
      expect(cash(player(s))).toBe(125);
      expect(currentEmployment(s)).toBeUndefined();
      expect(validateAction(s, { type: "work", actor: "player" })).toMatch(
        /employment/i,
      );
      s = hire(s);
      expect(s.ap).toBe(1);
      expect(s.progression.cleanEarned).toBe(0);
      expect(currentEmployment(s)?.hiredDay).toBe(1);
      expect(nextShift(s, currentEmployment(s)!)).toBe(2);
      expect(
        s.characters[`resident-${home}`].relationships.player,
      ).toBeDefined();
      s = advanceDay(s);
      expect(shiftToday(s)?.employmentId).toBe(currentEmployment(s)?.id);
      expect(deserialize(serialize(s))).toEqual(s);
    },
  );
  it("offers a citywide warehouse route and enforces contacts and skills", () => {
    let s = newGame("Worker", "south");
    expect(
      validateAction(s, {
        type: "apply",
        actor: "player",
        jobId: "retail-nawf",
      }),
    ).toMatch(/contact/);
    s = hire(s, "warehouse");
    expect(nextShift(s, currentEmployment(s)!)).toBe(3);
    expect(validateAction(s, { type: "work", actor: "player" })).toBeTruthy();
  });
  it("pays once per shift, improves skill/trust/reliability and awards a modest raise", () => {
    let s = hire(newGame("Worker", "south"));
    const start = structuredClone(currentEmployment(s)!);
    for (let d = 0; d < 21; d++) {
      if (shiftToday(s)) {
        const wage = currentEmployment(s)!.wage,
          before = player(s).wallet.clean,
          skill = player(s).skills.work;
        s = action(s, "work");
        expect(s.ap).toBe(0);
        expect(player(s).wallet.clean).toBe(before + wage);
        expect(player(s).skills.work).toBe(skill + 1);
        const snapshot = serialize(s);
        expect(
          performAction(s, { type: "work", actor: "player" }).error,
        ).toBeTruthy();
        expect(serialize(s)).toBe(snapshot);
        s = finishScenes(s);
      } else if (s.ap) s = action(s, "rest");
      s = advanceDay(s);
      s = deserialize(serialize(s));
    }
    const e = currentEmployment(s)!;
    expect(e.performance).toBe(9);
    expect(e.attendance).toHaveLength(9);
    expect(e.wage).toBe(104);
    expect(e.reliability).toBeGreaterThan(start.reliability);
    expect(s.characters[e.employer].relationships.player.trust).toBeGreaterThan(
      20,
    );
    expect(
      s.ledger
        .filter((x) => x.reason === "Daily living expenses")
        .reduce((a, x) => a - x.amount, 0),
    ).toBe(21 * 18);
    expect(
      s.commitments.filter((c) => c.kind === "employment-shift").length,
    ).toBeLessThanOrEqual(10);
    expect(s.events.filter((e) => e.title === "Wage increase")).toHaveLength(1);
  });
  it("warns before absence, fires at three of five, preserves cooldown across saves and allows gigs", () => {
    let s = hire(newGame("Worker", "south"));
    while (s.day < 7) s = advanceDay(s);
    expect(currentEmployment(s)).toBeUndefined();
    const e = s.employment[0];
    expect(e.status).toBe("terminated");
    expect(e.warnings).toBe(1);
    expect(e.attendance.filter((a) => a.status === "missed")).toHaveLength(3);
    expect(e.reliability).toBe(6);
    expect(e.endedDay).toBe(6);
    expect(s.employmentSearch.player.eligibleDay).toBe(13);
    s = deserialize(serialize(s));
    for (; s.day < 13; s = advanceDay(s)) {
      expect(
        validateAction(s, {
          type: "apply",
          actor: "player",
          jobId: "warehouse",
        }),
      ).toMatch(/reopen/);
      s = action(s, "gig");
      expect(validateAction(s, { type: "gig", actor: "player" })).toMatch(
        /complete/,
      );
      expect(
        s.commitments.some(
          (c) => c.kind === "employment-shift" && c.status === "pending",
        ),
      ).toBe(false);
    }
    s = hire(s, "warehouse");
    expect(currentEmployment(s)?.reliability).toBe(6);
    expect(
      s.events.filter((e) => e.title === "Employment terminated"),
    ).toHaveLength(1);
    let warning = hire(newGame("Warn", "south"));
    warning = advanceDay(warning);
    expect(absenceWarning(warning)).toMatch(/forfeits \$96/);
  });
  it("excuses unpaid leave, limits leave, and resignation releases obligations without wiping history", () => {
    let s = advanceDay(hire(newGame("Worker", "south")));
    s = action(s, "timeOff");
    expect(s.employment[0].attendance[0].status).toBe("excused");
    expect(s.progression.cleanEarned).toBe(0);
    expect(absenceWarning(s)).toBeNull();
    s = advanceDay(advanceDay(s));
    expect(validateAction(s, { type: "timeOff", actor: "player" })).toMatch(
      /again/,
    );
    s = action(s, "resign");
    expect(s.employment[0].status).toBe("resigned");
    expect(
      s.commitments.some(
        (c) => c.kind === "employment-shift" && c.status === "pending",
      ),
    ).toBe(false);
    expect(
      validateAction(s, { type: "apply", actor: "player", jobId: "warehouse" }),
    ).toMatch(/reopen/);
    for (let d = 0; d < 3; d++) s = advanceDay(s);
    expect(
      validateAction(s, {
        type: "apply",
        actor: "player",
        jobId: "retail-south",
      }),
    ).toMatch(/rehire/);
    expect(s.employment[0].attendance).toHaveLength(1);
  });
  it("uses a rolling five scheduled shifts so old absences expire", () => {
    let s = hire(newGame("Worker", "south"));
    for (let day = 1; day <= 24; day++) {
      if (shiftToday(s) && ![2, 4, 23].includes(s.day))
        s = finishScenes(action(s, "work"));
      s = advanceDay(s);
    }
    expect(currentEmployment(s)).toBeDefined();
    expect(
      s.employment[0].attendance.filter((a) => a.status === "missed"),
    ).toHaveLength(3);
  });
  it("shows actual time / money tradeoffs with The Chains", () => {
    let base = hire(newGame("Worker", "south", 7));
    const intro = base.encounters.find(
      (e) => e.definitionId === "mega-chains-request",
    )!;
    base = respondEncounter(base, intro.id, "promise").state;
    base = action(base, "gig");
    base = advanceDay(base);
    const working = action(base, "work");
    expect(working.ap).toBe(0);
    expect(
      performAction(working, {
        type: "buyback",
        actor: "player",
        incidentId: "the-chains",
      }).error,
    ).toMatch(/AP/);
    let helping = action(base, "gig");
    helping = action(helping, "buyback", { incidentId: "the-chains" });
    helping = advanceDay(helping);
    expect(helping.employment[0].attendance[0].status).toBe("missed");
    expect(
      helping.commitments.find((c) => c.kind === "recover-property")?.status,
    ).toBe("fulfilled");
    let funded = advanceDay(working);
    funded = action(funded, "buyback", { incidentId: "the-chains" });
    expect(funded.incidents["the-chains"].resolution).toBe("buyback");
    expect(funded.employment[0].attendance[0].status).toBe("worked");
    expect(cash(player(funded))).toBeGreaterThan(cash(player(helping)));
  });
  it.each(["Difficult shift", "Coworker request", "Extra work offer"])(
    "contextual %s consequences are once-only, dismissible, persistent",
    (title) => {
      let s = advanceDay(hire(newGame("Worker", "south")));
      s = action(s, "work");
      // Use actual work event as trigger, independently of a particular seed's scene roll.
      for (const e of s.encounters.filter(
        (e) => e.definitionId === "workplace",
      ))
        e.status = "closed";
      const source = [...s.events]
        .reverse()
        .find((e) => e.text.includes("worked a scheduled shift"))!;
      source.title = title;
      syncEncounters(s);
      const scene = s.encounters.find((e) => e.sourceEventId === source.id)!;
      s = dismissEncounter(s, scene.id);
      expect(s.encounters.find((e) => e.id === scene.id)?.deferred).toBe(true);
      s = deserialize(serialize(s));
      // Ending the day resolves the disclosed default, even if presentation was deferred.
      const before = s.progression.cleanEarned;
      s = advanceDay(s);
      expect(s.progression.cleanEarned).toBe(before);
      expect(s.encounters.find((e) => e.id === scene.id)?.status).toBe(
        "acknowledged",
      );
      expect(respondEncounter(s, scene.id, "skip").error).toBeTruthy();
      expect(s.employment[0].attendance).toHaveLength(1);
    },
  );
  it.each(["Coworker request", "Extra work offer"])(
    "applies %s choice once and preserves directional relationships",
    (title) => {
      let s = advanceDay(hire(newGame("Worker", "south")));
      s = action(s, "work");
      for (const e of s.encounters) e.status = "closed";
      const event = record(
        s,
        "social",
        "Workplace request",
        ["player", "resident-south"],
        undefined,
        { title },
      );
      syncEncounters(s);
      const scene = s.encounters.find((e) => e.sourceEventId === event.id)!;
      const trust = s.characters.flacco.relationships.player.trust,
        before = s.progression.cleanEarned;
      const response = title === "Coworker request" ? "help" : "extra";
      const result = respondEncounter(s, scene.id, response);
      expect(result.error).toBeNull();
      s = result.state;
      if (response === "help")
        expect(s.characters.flacco.relationships.player.trust).toBe(trust + 4);
      else expect(s.progression.cleanEarned).toBe(before + 18);
      const snapshot = serialize(s);
      expect(respondEncounter(s, scene.id, response).error).toBeTruthy();
      expect(serialize(s)).toBe(snapshot);
      expect(deserialize(snapshot)).toEqual(s);
    },
  );
  it.each([1, 7, 21, 2026])(
    "30+ day strategies and deterministic replay seed %i",
    (seed) => {
      for (const strategy of [
        "stable",
        "gig-only",
        "unemployed",
        "fired-reapply",
        "mixed",
      ]) {
        let s = newGame("Worker", "south", seed);
        if (["stable", "fired-reapply", "mixed"].includes(strategy))
          s = hire(s);
        for (let day = 0; day < 35; day++) {
          if (
            strategy === "fired-reapply" &&
            !currentEmployment(s) &&
            s.day >= s.employmentSearch.player.eligibleDay
          )
            s = hire(s, "warehouse");
          if (shiftToday(s) && ["stable", "mixed"].includes(strategy))
            s = finishScenes(action(s, "work"));
          else if (strategy !== "unemployed") {
            s = action(s, "gig");
            if (
              strategy === "mixed" &&
              s.day % 7 === 0 &&
              !validateAction(s, { type: "crime", actor: "player" })
            )
              s = action(s, "crime");
            else if (s.ap) s = action(s, "rest");
          } else if (s.ap) s = action(s, "rest");
          expect(player(s).wallet.clean).toBeGreaterThanOrEqual(0);
          expect(player(s).wallet.illicit).toBeGreaterThanOrEqual(0);
          expect(player(s).stress).toBeLessThanOrEqual(100);
          expect(s.end).toBeNull();
          expect(new Set(s.commitments.map((c) => c.id)).size).toBe(
            s.commitments.length,
          );
          const loaded = deserialize(serialize(s));
          expect(advanceDay(loaded)).toEqual(advanceDay(s));
          s = advanceDay(s);
        }
        if (strategy === "stable") {
          expect(currentEmployment(s)).toBeDefined();
          expect(player(s).stress).toBeLessThan(35);
        }
        if (strategy === "gig-only")
          expect(cash(player(s))).toBe(125 + 35 * (BALANCE.gigIncome - 18));
      }
    },
    30000,
  );
});
