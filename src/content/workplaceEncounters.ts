import type { EncounterDefinition, EncounterResponse } from "../core/Encounter";
const response = (id: string, label: string): EncounterResponse => ({
  id,
  label,
  effect: { type: "workplace", choice: id },
});
export const WORKPLACE_ENCOUNTER: EncounterDefinition = {
  id: "workplace",
  type: "request",
  participants: [],
  priority: 85,
  trigger: (s) =>
    s.events
      .filter((e) =>
        ["Difficult shift", "Coworker request", "Extra work offer"].includes(
          e.title ?? "",
        ),
      )
      .map((e) => ({ key: e.id, eventId: e.id })),
  eligible: (s, e) => e.createdDay === s.day,
  dialogue: (s, e) => {
    const event = s.events.find((x) => x.id === e.sourceEventId)!;
    return event.title === "Difficult shift"
      ? "The delivery numbers don't match. Can you push through and fix it, or should we flag it for the next shift?"
      : event.title === "Coworker request"
        ? "Flacco is here on a local delivery gig. He could use a hand clearing the station. Can you spare the effort?"
        : "You keep showing up. There's an extra $18 for finishing this task before you leave. It'll be a tiring finish. Interested?";
  },
  responses: (s, e) => {
    const title = s.events.find((x) => x.id === e.sourceEventId)?.title;
    return [
      ...(title === "Difficult shift"
        ? [
            response("push", "Fix it · +6 stress, better performance"),
            response("flag", "Flag it · −3 reliability, keep wages"),
          ]
        : title === "Coworker request"
          ? [response("help", "Help Flacco · +4 stress, build trust")]
          : [response("extra", "Take the task · +$18, +10 stress")]),
      response(
        "skip",
        title === "Difficult shift"
          ? "Skip scene · Flag it, −3 reliability"
          : "Skip scene · Pass, keep regular pay",
      ),
    ];
  },
  rules: { replay: "read-only", expiresWithIncident: false },
};
