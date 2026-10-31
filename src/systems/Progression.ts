import { player, type GameState } from "../core/GameState";
import { BALANCE } from "../content/balance";
import { record } from "../core/EventLog";
export function progress(s: GameState) {
  const p = player(s);
  const qualifying = Math.floor(p.influence / 1);
  const capacity = Math.min(
    BALANCE.maxCrew,
    BALANCE.capacityMilestones.filter((n) => qualifying >= n).length,
  );
  if (capacity > s.crew.capacity) {
    s.crew.capacity = capacity;
    record(s, "crew", `Your influence supports a Set of ${capacity}.`, [p.id]);
  }
}
