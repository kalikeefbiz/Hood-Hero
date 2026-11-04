import { arrest } from "./Incarceration";
import {
  decayExposure,
  exposureScore,
  ongoingArrestChance,
} from "./CriminalExposure";
import { STREET_BALANCE as B } from "../content/street";
import { clamp, type GameState } from "../core/GameState";
import { random } from "../core/Random";
import { record } from "../core/EventLog";
export function advancePressure(s: GameState) {
  for (const c of Object.values(s.characters)) {
    if (c.status !== "active") continue;
    // Danger is contingent on accumulated exposure, never elapsed campaign time.
    const score = exposureScore(s, c.id, c.home);
    if (
      ongoingArrestChance(s, c.id) > 0 &&
      random(s) < ongoingArrestChance(s, c.id)
    ) {
      arrest(s, c.id, "accumulated criminal exposure", score > 80 ? 2 : 1);
    } else if (
      c.id !== s.playerId &&
      c.rivalThreat > 70 &&
      random(s) < (c.rivalThreat - 65) / 240
    ) {
      c.status = "dead";
      record(
        s,
        "risk",
        `${c.name} was killed in an active rival conflict.`,
        [c.id],
        ["player", c.id],
        s.crew.members.includes(c.id)
          ? {
              importance: "critical",
              title: `Set member ${c.status}: ${c.name}`,
            }
          : {},
      );
    }
    c.police = clamp(c.police - B.policeDecay);
    c.rivalThreat = clamp(c.rivalThreat - 2);
    c.stress = clamp(c.stress - 2);
  }
  decayExposure(s);
}
