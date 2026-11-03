import { performAction } from "../core/ActionEngine";
import { progress } from "../systems/Progression";
// Controlled distant-progression fixtures. Public gameplay has no debug controls.
import { newGame } from "../core/Simulation";
import { applyInfluence, resolveTerritories } from "../systems/Territory";
import { connect } from "../systems/Relationships";
import type { GameState, ZoneId } from "../core/GameState";
export function consolidate(
  s: GameState,
  zones: ZoneId[],
  faction: "angels" | "blocks" = "angels",
) {
  // Future authored contributions use the exact same effect interface. No map/controller writes.
  for (let day = 0; day < 24; day++) {
    s.day++;
    for (const zone of zones) {
      for (const kind of [
        "support",
        "economic",
        "community",
        "defense",
        "challenge",
      ] as const)
        applyInfluence(s, {
          actor: "player",
          faction,
          zone,
          kind,
          magnitude: 20,
          cause: "Controlled sustained organizational campaign",
        });
      for (const rival of Object.keys(
        s.factions,
      ) as (keyof typeof s.factions)[])
        if (rival !== faction)
          applyInfluence(s, {
            actor: "player",
            faction: rival,
            zone,
            kind: "disruption",
            magnitude: 20,
            cause: "Controlled competing economic decline",
          });
    }
    resolveTerritories(s);
  }
  return s;
}
export function underlordReady() {
  const s = newGame("Test(7) Council", "rio");
  s.characters.player.affiliation = "angels";
  s.characters.player.authority = 70;
  s.day = 90;
  s.strategic.membershipDay = 1;
  s.strategic.contributions.angels = 900;
  s.characters.player.organizationStanding.angels = 90;
  connect(s, "player", "pablo");
  s.characters.pablo.relationships.player.trust = 75;

  s.characters.joker.relationships.player.trust = 80;

  connect(s, "player", "joker");
  s.characters.player.influence = 15;
  progress(s);
  const recruited = performAction(s, {
    actor: "player",
    type: "recruit",
    target: "joker",
  });
  if (recruited.error) throw new Error(recruited.error);
  return consolidate(recruited.state, ["downtown", "rio", "south", "reservoir"]);
}
