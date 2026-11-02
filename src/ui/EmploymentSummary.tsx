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
    <section className="panel employment-summary" aria-label="Employment">
      <p className="eyebrow">EMPLOYMENT / LAWFUL INCOME</p>
      <h3>{e ? jobDefinition(e.jobId).name : "Unemployed"}</h3>
      {e ? (
        <>
          <p>
            {s.zones[e.location].name} · Hiring contact:{" "}
            {s.characters[e.employer].name}
          </p>
          <p>
            <strong>{money(e.wage)} / shift · 2 AP</strong> ·{" "}
            {e.workdays.map((d) => WEEKDAYS[d]).join(" / ")}
          </p>
          <p>
            Next shifts:{" "}
            {upcoming
              .map(
                (d) =>
                  `Day ${d}${e.timeOffDays.includes(d) ? " (unpaid leave)" : ""}`,
              )
              .join(" · ")}
          </p>
          <p>
            Reliability {e.reliability}/100 · Performance {e.performance} ·
            Formal warnings {e.warnings} · Employer trust{" "}
            {s.characters[e.employer].relationships[s.playerId]?.trust ?? 0}
          </p>
          <p className="muted">
            Three absences in the last five scheduled shifts end the job. One
            unpaid leave per seven days. Six reliable shifts can earn an $8
            raise.
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
        Earned lawful income:{" "}
        <strong>{money(s.progression.cleanEarned)}</strong> · Living costs: $18
        / day
      </p>
      {s.employment
        .filter((x) => x.actor === s.playerId && x.status !== "employed")
        .slice(-2)
        .map((x) => (
          <p key={x.id}>
            {jobDefinition(x.jobId).name} · {x.status} on day {x.endedDay}
          </p>
        ))}
    </section>
  );
}
