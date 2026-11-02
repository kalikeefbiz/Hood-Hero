import {
  clamp,
  type GameState,
  type EncounterInstance,
} from "../core/GameState";
import { record } from "../core/EventLog";
import { earn } from "./Economy";
import { change, remember } from "./Relationships";
import { currentEmployment } from "./Employment";
// Base wages and attendance were committed by the shift action. Scene outcomes are once-only additions.
export function resolveWorkplace(
  s: GameState,
  encounter: EncounterInstance,
  choice: string,
) {
  if (
    encounter.selectedResponses.length ||
    !["active", "pending"].includes(encounter.status)
  )
    return;
  const e = currentEmployment(s),
    p = s.characters[s.playerId];
  const source = s.events.find((x) => x.id === encounter.sourceEventId)!;
  let text = "";
  if (source.title === "Difficult shift") {
    if (choice === "push") {
      p.stress = clamp(p.stress + 6);
      if (e) e.performance++;
      text =
        "You fixed the delivery count. +6 stress, performance improved; full wages retained.";
    } else {
      if (e) {
        e.reliability = clamp(e.reliability - 3);
        change(s.characters[e.employer], p.id, { respect: -2 });
      }
      text =
        "You flagged the problem for the next shift. Reliability −3; wages retained, no extra stress.";
    }
  } else if (source.title === "Coworker request") {
    const coworker = s.characters["flacco"];
    if (choice === "help") {
      change(coworker, p.id, { trust: 4, respect: 2 });
      change(p, coworker.id, { trust: 2 });
      p.stress = clamp(p.stress + 4);
      text = `${coworker.name} appreciated the help with a local delivery. +4 stress; trust grew.`;
    } else
      text = "You kept to your own station. No additional stress or reward.";
  } else {
    if (choice === "extra") {
      earn(s, p, 18, "clean", "Extra shift task");
      p.stress = clamp(p.stress + 10);
      text = "You finished the extra task. +$18 lawful pay, +10 stress.";
    } else
      text = "You passed on the extra task and kept your regular shift pay.";
  }
  const coworker = source.title === "Coworker request" ? "flacco" : null;
  const event = record(
    s,
    "social",
    text,
    [
      ...new Set([
        p.id,
        ...encounter.participants,
        ...(coworker ? [coworker] : []),
      ]),
    ],
    undefined,
    { importance: "personal" },
  );
  if (coworker && choice === "help") {
    remember(
      s,
      coworker,
      p.id,
      event.id,
      "Helped me finish a local delivery.",
      4,
    );
    remember(s, p.id, coworker, event.id, text, 2);
  }
  if (e) {
    e.eventIds.push(event.id);
    remember(s, e.employer, p.id, event.id, text, 1);
  }
  encounter.status = "acknowledged";
  encounter.followUpPending = false;
  encounter.selectedResponses.push({
    id: choice,
    day: s.day,
    eventIds: [event.id],
  });
}
export function settleWorkplaceScenes(s: GameState) {
  for (const e of s.encounters.filter(
    (e) =>
      e.definitionId === "workplace" &&
      ["active", "pending"].includes(e.status),
  ))
    resolveWorkplace(s, e, "skip");
}
