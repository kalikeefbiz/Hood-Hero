import { player, type GameState } from "../core/GameState";
import { currentEmployment } from "../systems/Employment";
import { deriveCityView, type ZoneView } from "../city3d/viewModel";
import { ZONE_ORDER } from "../city3d/layout";
import type { ZoneId } from "../core/GameState";
import { deriveBlocks, type BlockView } from "./blocks";
import { LOCATIONS } from "./locations";
import { placeActions, placeIsLive } from "./interactions";

export interface PlaceStatus {
  live: boolean;
  owned: boolean;
  employed: boolean;
  /** The player's home base in their home district. */
  home: boolean;
  /** Number of existing actions available right here, right now. */
  actions: number;
}
export interface BoardView {
  day: number;
  playerAccent: string;
  zones: Record<ZoneId, ZoneView>;
  blocks: Record<string, BlockView>;
  places: Record<string, PlaceStatus>;
}

/** Read-only projection of saved state for the board. Never mutates `s`. */
export function deriveBoardView(s: GameState): BoardView {
  const city = deriveCityView(s);
  const p = player(s);
  const job = currentEmployment(s);
  const homeBase = LOCATIONS.find((l) => l.zone === p.home && l.links.rest);
  const places: Record<string, PlaceStatus> = {};
  for (const l of LOCATIONS) {
    const owned =
      !!l.links.business &&
      s.strategic.businesses.some(
        (b) =>
          b.definition === l.links.business &&
          !["sold", "closed"].includes(b.status),
      );
    places[l.id] = {
      live: placeIsLive(s, l),
      owned,
      employed: !!job && job.jobId === l.links.job,
      home: homeBase?.id === l.id,
      actions: placeActions(s, l).length,
    };
  }
  void ZONE_ORDER;
  return {
    day: s.day,
    playerAccent: city.playerAccent,
    zones: city.zones,
    blocks: deriveBlocks(s),
    places,
  };
}
