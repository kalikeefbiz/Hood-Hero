import type { GameState, GameEvent } from "../core/GameState";
import { visibleEvents } from "../core/EventLog";
import { themeStyle } from "./theme";
export function ActivityFeed({
  s,
  personal = false,
}: {
  s: GameState;
  personal?: boolean;
}) {
  const visible = visibleEvents(s).filter(
    (e) => !personal || e.category !== "city",
  );
  const recent = new Set(
    visible
      .filter((e) => e.importance !== "routine")
      .slice(-80)
      .map((e) => e.id),
  );
  const days = [...new Set(visible.map((e) => e.day))].reverse();
  const describe = (e: GameEvent) =>
    e.factionId ? s.factions[e.factionId].name : e.category.toUpperCase();
  return (
    <div className="timeline">
      {days.map((day) => {
        const events = visible.filter((e) => e.day === day),
          significant = events.filter((e) => recent.has(e.id)).reverse(),
          routine = events.filter((e) => e.importance === "routine");
        if (!significant.length && !routine.length) return null;
        return (
          <div className="activity-day" key={day}>
            <h3 className="timeline-day">
              Day {day.toString().padStart(2, "0")}
            </h3>
            {significant.map((e) => (
              <article
                key={e.id}
                className={`event-entry event-${e.importance ?? "personal"}`}
                data-event-id={e.id}
                data-importance={e.importance ?? "personal"}
                data-faction={e.factionId}
                style={e.factionId ? themeStyle(e.factionId) : undefined}
              >
                <span className="timeline-dot" />
                <div>
                  <small>
                    DAY {e.day} / {describe(e)}{" "}
                    <b className="severity-label">
                      {e.importance === "critical"
                        ? "CRITICAL"
                        : e.importance === "major"
                          ? "MAJOR"
                          : ""}
                    </b>
                  </small>
                  {e.title && <h4>{e.title}</h4>}
                  <p>{e.text}</p>
                </div>
              </article>
            ))}
            {routine.length > 0 && (
              <details className="routine-summary">
                <summary>
                  Day {day} · {routine.length} routine reports
                  {[
                    ...new Set(
                      routine.flatMap((e) =>
                        e.factionId ? [s.factions[e.factionId].name] : [],
                      ),
                    ),
                  ].length
                    ? ` · ${new Set(routine.flatMap((e) => (e.factionId ? [e.factionId] : []))).size} organizations`
                    : ""}
                </summary>
                {routine
                  .slice()
                  .reverse()
                  .map((e) => (
                    <p
                      key={e.id}
                      data-faction={e.factionId}
                      style={e.factionId ? themeStyle(e.factionId) : undefined}
                    >
                      <strong>{describe(e)}</strong> · {e.text}
                    </p>
                  ))}
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
