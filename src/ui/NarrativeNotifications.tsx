import { copy } from "../content/copy";
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
  const event =
    unseen.filter((e) => e.importance === "critical").at(-1) ?? unseen.at(-1)!;
  const encounter = s.encounters.find((e) => e.sourceEventId === event.id);
  const speaker = encounter?.participants.find((id) => id !== s.playerId);
  const speakerName = speaker
    ? (s.characters[speaker].alias ?? s.characters[speaker].name)
    : "this person";
  return (
    <section
      className="major-notification"
      aria-label={copy(
        "interface.narrativeNotifications.importantDevelopments",
      )}
      aria-live="polite"
    >
      <p className="eyebrow">
        {unseen.length}
        {copy("interface.narrativeNotifications.unseenIMPORTANT")}{" "}
        {unseen.length === 1 ? "DEVELOPMENT" : "DEVELOPMENTS"}
      </p>
      <h3>{event.title ?? "A major development"}</h3>
      <p>{event.text}</p>
      <div className="notification-controls">
        {s.encounters.some((e) => e.sourceEventId === event.id) && (
          <button onClick={() => view(event.id)}>
            {copy("interface.narrativeNotifications.hear")}
            {speakerName}
            {copy("interface.narrativeNotifications.sResponse")}
          </button>
        )}
        <button className="secondary" onClick={() => acknowledge(event.id)}>
          {copy("interface.narrativeNotifications.acknowledge")}
        </button>
      </div>
    </section>
  );
}
