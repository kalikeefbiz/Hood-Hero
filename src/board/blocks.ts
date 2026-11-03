import type { FactionId, GameState, ZoneId } from "../core/GameState";
import { THEMES } from "../ui/theme";
import {
  ALL_BLOCKS,
  ZONE_ORDER,
  locationBlock,
  type BlockDef,
} from "../city3d/layout";
import { LOCATIONS } from "./locations";

// ---------------------------------------------------------------------------
// Block influence is a PRESENTATION of existing territory state, not a new
// simulation. Each district's saved footholds (presence per organization)
// decide how many blocks visibly carry an organization's marks, growing
// outward from that organization's anchor. When Vesper/Codex add real
// block-level control, replace `deriveBlocks` and keep the BlockView shape.
// ---------------------------------------------------------------------------

export interface BlockView {
  id: string;
  zone: ZoneId;
  faction: FactionId | null;
  color: string;
  /** 0..1: how strongly the marks show (flags, tags, crowds). */
  strength: number;
  /** Border between rivals, or the whole district is contested. */
  contested: boolean;
  police: number;
  locations: string[];
}

/** Where each organization's presence radiates from. */
const ANCHORS: Partial<Record<FactionId, string>> = {
  angels: "rio.angels-mural",
  backstreet: "south.towers",
  blocks: "reservoir.lot-court",
};

export function deriveBlocks(s: GameState): Record<string, BlockView> {
  const out: Record<string, BlockView> = {};
  for (const zone of ZONE_ORDER) {
    const z = s.zones[zone],
      t = s.strategic.territories[zone];
    const blocks = ALL_BLOCKS.filter((b) => b.zone === zone && !b.waterfront);
    const present = (Object.keys(t.factions) as FactionId[])
      .filter(
        (f) => z.organizations.includes(f) || t.factions[f].presence >= 15,
      )
      .sort((a, b) => t.factions[b].presence - t.factions[a].presence);
    const claim = new Map<string, { f: FactionId; rank: number }[]>();
    const order = (f: FactionId, index: number): BlockDef[] => {
      if (zone === "nawf" && present.length > 1) {
        // The Nawf: Blips hold the west side of the avenue, Mudgang the east.
        const west = f === "blips" || (f !== "muds" && index === 0);
        return [...blocks].sort((a, b) =>
          west ? a.minX - b.minX : b.minX - a.minX,
        );
      }
      const anchor = LOCATIONS.find((l) => l.id === ANCHORS[f]);
      const ab = anchor ? locationBlock(anchor) : null;
      const ax = ab ? (ab.minX + ab.maxX) / 2 : 0,
        az = ab ? (ab.minZ + ab.maxZ) / 2 : 0;
      return [...blocks].sort(
        (a, b) =>
          Math.hypot((a.minX + a.maxX) / 2 - ax, (a.minZ + a.maxZ) / 2 - az) -
          Math.hypot((b.minX + b.maxX) / 2 - ax, (b.minZ + b.maxZ) / 2 - az),
      );
    };
    present.forEach((f, index) => {
      const presence = t.factions[f].presence;
      const count = Math.round(blocks.length * Math.min(0.92, presence / 85));
      order(f, index)
        .slice(0, count)
        .forEach((b, rank) => {
          const list = claim.get(b.id) ?? [];
          list.push({ f, rank });
          claim.set(b.id, list);
        });
    });
    for (const b of ALL_BLOCKS.filter((b) => b.zone === zone)) {
      const claims = (claim.get(b.id) ?? []).sort((a, c) => a.rank - c.rank);
      const top = claims[0];
      const contested = claims.length > 1 || (t.contested && !!top);
      const presence = top ? t.factions[top.f].presence : 0;
      out[b.id] = {
        id: b.id,
        zone,
        faction: top?.f ?? null,
        color: top ? THEMES[top.f].accent : "#A8ADB3",
        strength: top ? Math.max(0.25, Math.min(1, presence / 70)) : 0,
        contested,
        police: z.police,
        locations: LOCATIONS.filter((l) => locationBlock(l)?.id === b.id).map(
          (l) => l.id,
        ),
      };
    }
  }
  return out;
}
