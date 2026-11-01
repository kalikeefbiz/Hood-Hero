import type { GameState } from "../core/GameState";
import { unseenEvents } from "../core/EventLog";
export function NarrativeNotifications({
  s,
  acknowledge,
  view,
}: {
  s: GameState;
  acknowledge: (id: string) => void;
  view: (id: string) => void;
}) {
  const unseen = unseenEvents(s);
  if (!unseen.length) return null;
  const event = unseen.at(-1)!;
  return (
    <section
      className="major-notification"
      aria-label="Important developments"
      aria-live="polite"
    >
      <p className="eyebrow">
        {unseen.length} UNSEEN IMPORTANT{" "}
        {unseen.length === 1 ? "DEVELOPMENT" : "DEVELOPMENTS"}
      </p>
      <h3>{event.title ?? "A major development"}</h3>
      <p>{event.text}</p>
      <div className="notification-controls">
        {s.encounters.some((e) => e.sourceEventId === event.id) && (
          <button onClick={() => view(event.id)}>Hear Cuzzo’s response</button>
        )}
        <button className="secondary" onClick={() => acknowledge(event.id)}>
          Acknowledge
        </button>
      </div>
    </section>
  );
}
