import { considerCrewOffer } from "./CrewAgency";
import { shiftToday } from "./Employment";
import { cash, type GameState, type Character } from "../core/GameState";
import { random } from "../core/Random";
import {
  resolveAction,
  validateAction,
  type Action,
} from "../core/ActionEngine";
// Utility scores derive from goals, needs, values, memories and obligations.
function decide(s: GameState, c: Character): Action | null {
  if (
    c.status !== "active" ||
    c.availableDay > s.day ||
    s.commitments.some(
      (o) =>
        o.actor === c.id &&
        o.status === "pending" &&
        o.kind !== "employment-shift" &&
        o.kind !== "supplier-debt" &&
        o.kind !== "recover-property" &&
        (o.kind !== "crew-activity" || o.dueDay === s.day),
    )
  )
    return null;
  if (shiftToday(s, c.id)) return { actor: c.id, type: "work" };
  const options: { action: Action; score: number }[] = [];
  const add = (action: Action, score: number) => {
    if (!validateAction(s, action))
      options.push({
        action,
        score:
          score +
          random(
            action.target && ["quanny", "mr-lewis"].includes(action.target)
              ? s.quanny
              : s,
          ) *
            5,
      });
  };
  add(
    { actor: c.id, type: "gig" },
    (cash(c) < 100 ? 65 : 15) +
      (c.goals.includes("income") ? 15 : 0) +
      c.skills.work / 10,
  );
  add({ actor: c.id, type: "rest" }, c.stress > 45 ? 90 : 5);
  if (c.traits.risk > 60)
    add(
      { actor: c.id, type: "crime" },
      (c.goals.includes("status") ? 35 : 10) +
        c.traits.ambition / 5 -
        c.police / 2,
    );
  for (const target of c.known) {
    const other = s.characters[target];
    if (!other || other.id === c.id || other.status !== "active") continue;
    const r = c.relationships[target];
    if ((r?.grievance ?? 0) > 40) continue;
    const memory =
      c.memories
        .slice(-10)
        .filter((m) => m.about === target)
        .reduce((n, m) => n + m.weight, 0) / 10;
    const obligation = c.goals.includes("loyalty") ? c.traits.loyalty / 4 : 0;
    add(
      { actor: c.id, type: "socialize", target },
      20 + obligation + (r?.trust ?? 0) / 5 + memory + other.influence / 10,
    );
  }
  options.sort((a, b) => b.score - a.score);
  return options[0]?.action ?? null;
}
export function advanceNPCs(s: GameState) {
  for (const c of Object.values(s.characters).sort(
    (a, b) =>
      Number(["quanny", "mr-lewis"].includes(a.id)) -
      Number(["quanny", "mr-lewis"].includes(b.id)),
  )) {
    if (c.id === s.playerId) continue;
    const authored = ["quanny", "mr-lewis"].includes(c.id),
      previousRng = s.rng;
    if (authored) s.rng = s.quanny.rng;
    try {
      considerCrewOffer(s, c);
      if (c.agency.lastAssignmentDay === s.day) continue;
      const action = decide(s, c);
      if (action) resolveAction(s, action);
    } finally {
      if (authored) {
        s.quanny.rng = s.rng;
        s.rng = previousRng;
      }
    }
  }
}
