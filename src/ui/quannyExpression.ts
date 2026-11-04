/** Read-only portrait selection from existing dialogue and outcome evidence. */
import type { EncounterInstance, GameState } from "../core/GameState";
import type { Expression } from "./characterArt";

export function quannyExpression(
  s: GameState,
  e: EncounterInstance,
): Expression {
  const last = e.selectedResponses.at(-1);
  const choice = last?.id;
  const evidence = new Set(last?.eventIds ?? []);
  if (
    e.deferred ||
    [
      "leave",
      "decline",
      "disrespect",
      "rob",
      "fight",
      "retaliate",
      "claim:angels",
    ].includes(choice ?? "")
  )
    return "concerned";
  if (choice === "claim:blocks" && s.quanny.deception === "known")
    return "concerned";
  if (
    s.events.some(
      (event) =>
        evidence.has(event.id) &&
        event.observedBy.includes(s.playerId) &&
        event.category === "risk",
    )
  )
    return "concerned";

  // Historical payment reactions follow the recorded collection, even if reputation changes later.
  const collection = s.street.agreements
    .flatMap((a) => a.collections ?? [])
    .find((c) => evidence.has(c.eventId));
  if (collection)
    return collection.result === "paid" ? "confident" : "concerned";
  if (choice === "front" || choice === "negotiate") {
    const agreed = s.street.agreements.some(
      (a) => a.debtor === "quanny" && a.history.some((id) => evidence.has(id)),
    );
    return agreed ? "confident" : "concerned";
  }
  if (choice === "reconcile") return "strategizing";
  if (choice === "repair")
    return s.quanny.business === "open" ? "confident" : "concerned";

  if (e.definitionId === "quanny") {
    if (s.quanny.business === "blocked") return "concerned";
    if (!s.quanny.claim) return "neutral";
    if (
      s.quanny.business === "new" ||
      choice === "terms" ||
      choice === "explain" ||
      choice === "decline-details" ||
      choice?.startsWith("claim:")
    )
      return "proposing";
    const proposal = s.street.lots.some(
      (l) => l.owner === s.playerId && l.remaining > 0,
    );
    const pending = s.street.agreements.some(
      (a) =>
        a.debtor === "quanny" &&
        a.supplier === s.playerId &&
        a.balance > 0 &&
        a.status !== "disputed",
    );
    return proposal || pending ? "strategizing" : "neutral";
  }
  if (e.definitionId === "living-danger") {
    const scene = s.danger.scenes.find((scene) => scene.id === e.dangerSceneId);
    if (scene?.status === "resolved" && choice) {
      const conflict = s.danger.conflicts.find(
        (conflict) => conflict.id === scene.conflictId,
      );
      return conflict && conflict.state !== "settled"
        ? "concerned"
        : "confident";
    }
    return scene?.motive === "war" || scene?.motive === "history"
      ? "concerned"
      : "neutral";
  }
  if (e.definitionId === "street-supplier") {
    if (choice && choice !== "terms") return "confident";
    return "proposing";
  }
  if (e.definitionId.startsWith("crew-")) {
    const assignment = s.assignments.find(
      (a) => a.member === "quanny" && a.eventIds.some((id) => evidence.has(id)),
    );
    if (assignment?.status === "refused" || assignment?.success === false)
      return "concerned";
    if (choice === "accept" || assignment) return "confident";
    return e.definitionId === "crew-offer" ? "proposing" : "strategizing";
  }
  return "neutral";
}
