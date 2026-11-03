import { copy } from "../content/copy";
import type { GameState } from "../core/GameState";
import {
  currentEmployment,
  nextShift,
  searchState,
} from "../systems/Employment";
import { jobDefinition, WEEKDAYS } from "../content/jobs";
import { money } from "./ActionCard";
export function EmploymentSummary({ s }: { s: GameState }) {
  const e = currentEmployment(s),
    search = searchState(s, s.playerId);
  const upcoming: number[] = [];
  if (e) {
    let d = nextShift(s, e);
    while (d !== undefined && upcoming.length < 3) {
      upcoming.push(d);
      d = nextShift(s, e, d + 1);
    }
  }
  return (
    <section
      className="panel employment-summary"
      aria-label={copy("interface.employmentSummary.employment")}
    >
      <p className="eyebrow">
        {copy("interface.employmentSummary.employmentLAWFULINCOME")}
      </p>
      <h3>{e ? jobDefinition(e.jobId).name : "Unemployed"}</h3>
      {e ? (
        <>
          <p>
            {s.zones[e.location].name}
            {copy("interface.employmentSummary.hiringContact")}{" "}
            {s.characters[e.employer].name}
          </p>
          <p>
            <strong>
              {money(e.wage)}
              {copy("interface.employmentSummary.shift2AP")}
            </strong>
            {copy("interface.employmentSummary.text")}{" "}
            {e.workdays.map((d) => WEEKDAYS[d]).join(" / ")}
          </p>
          <p>
            {copy("interface.employmentSummary.nextShifts")}{" "}
            {upcoming
              .map(
                (d) =>
                  `Day ${d}${e.timeOffDays.includes(d) ? " (unpaid leave)" : ""}`,
              )
              .join(" · ")}
          </p>
          <p>
            {copy("interface.employmentSummary.reliability")}
            {e.reliability}
            {copy("interface.employmentSummary.100Performance")}
            {e.performance}
            {copy("interface.employmentSummary.formalWarnings")}
            {e.warnings}
            {copy("interface.employmentSummary.employerTrust")}{" "}
            {s.characters[e.employer].relationships[s.playerId]?.trust ?? 0}
          </p>
          <p className="muted">
            {copy(
              "interface.employmentSummary.threeAbsencesInTheLastFiveScheduled",
            )}
          </p>
        </>
      ) : (
        <p>
          {s.day < search.eligibleDay
            ? `Formal applications reopen on day ${search.eligibleDay}. Local gigs remain available.`
            : "Apply in Actions, then accept an offer. Every neighborhood has a local route; warehouse applications are citywide."}
        </p>
      )}
      <p>
        {copy("interface.employmentSummary.earnedLawfulIncome")}{" "}
        <strong>{money(s.progression.cleanEarned)}</strong>
        {copy("interface.employmentSummary.livingCosts18Day")}
      </p>
      {s.employment
        .filter((x) => x.actor === s.playerId && x.status !== "employed")
        .slice(-2)
        .map((x) => (
          <p key={x.id}>
            {jobDefinition(x.jobId).name}
            {copy("interface.employmentSummary.text2")}
            {x.status}
            {copy("interface.employmentSummary.onDay")}
            {x.endedDay}
          </p>
        ))}
    </section>
  );
}
