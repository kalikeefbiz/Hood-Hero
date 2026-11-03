import { copy } from "./copy";
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
      ? copy("workplace-dialogue.theDeliveryNumbersDonTMatchCan")
      : event.title === "Coworker request"
        ? copy("workplace-dialogue.flaccoIsHereOnALocalDelivery")
        : copy("workplace-dialogue.youKeepShowingUpThereSAn");
  },
  responses: (s, e) => {
    const title = s.events.find((x) => x.id === e.sourceEventId)?.title;
    return [
      ...(title === "Difficult shift"
        ? [
            response(
              "push",
              copy("workplace-dialogue.fixIt6StressBetterPerformance"),
            ),
            response(
              "flag",
              copy("workplace-dialogue.flagIt3ReliabilityKeepWages"),
            ),
          ]
        : title === "Coworker request"
          ? [
              response(
                "help",
                copy("workplace-dialogue.helpFlacco4StressBuildTrust"),
              ),
            ]
          : [
              response(
                "extra",
                copy("workplace-dialogue.takeTheTask1810Stress"),
              ),
            ]),
      response(
        "skip",
        title === "Difficult shift"
          ? copy("workplace-dialogue.skipSceneFlagIt3Reliability")
          : copy("workplace-dialogue.skipScenePassKeepRegularPay"),
      ),
    ];
  },
  rules: { replay: "read-only", expiresWithIncident: false },
};
