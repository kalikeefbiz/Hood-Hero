import { clamp, type GameState } from "../core/GameState";
import { random } from "../core/Random";
import { record } from "../core/EventLog";
export function advancePressure(s: GameState) {
  for (const c of Object.values(s.characters)) {
    if (c.status !== "active") continue;
    // Danger is contingent on accumulated exposure, never elapsed campaign time.
    if (c.police > 65 && random(s) < (c.police - 60) / 180) {
      c.status = "arrested";
      record(
        s,
        "risk",
        `${c.name} was arrested after sustained police attention.`,
        [c.id],
        ["player", c.id],
      );
    } else if (c.rivalThreat > 70 && random(s) < (c.rivalThreat - 65) / 240) {
      c.status = "dead";
      record(
        s,
        "risk",
        `${c.name} was killed in an active rival conflict.`,
        [c.id],
        ["player", c.id],
      );
    }
    c.police = clamp(c.police - 4);
    c.rivalThreat = clamp(c.rivalThreat - 2);
    c.stress = clamp(c.stress - 2);
  }
}
