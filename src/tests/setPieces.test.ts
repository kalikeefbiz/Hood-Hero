import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  ZONE_ORDER,
  districtGrid,
  locationBlock,
} from "../city3d/layout";
import { LOCATIONS } from "../board/locations";
import { SET_PIECES, planSetPieces, planUnderpass } from "../board/setPieces";

const empty = (zone: (typeof ZONE_ORDER)[number]) =>
  districtGrid(zone).blocks.filter(
    (b) =>
      !b.waterfront && !LOCATIONS.some((l) => locationBlock(l)?.id === b.id),
  );

describe("set pieces", () => {
  it("are seeded: the same city every session", () => {
    for (const zone of ZONE_ORDER)
      expect(planSetPieces(zone, empty(zone))).toEqual(
        planSetPieces(zone, empty(zone)),
      );
  });

  it("only use empty blocks and stay inside them", () => {
    for (const zone of ZONE_ORDER) {
      const blocks = new Map(empty(zone).map((b) => [b.id, b]));
      for (const p of planSetPieces(zone, empty(zone))) {
        const b = blocks.get(p.block)!;
        expect(b).toBeDefined();
        expect(p.rect.minX).toBeGreaterThanOrEqual(b.minX);
        expect(p.rect.maxX).toBeLessThanOrEqual(b.maxX);
        expect(p.rect.minZ).toBeGreaterThanOrEqual(b.minZ);
        expect(p.rect.maxZ).toBeLessThanOrEqual(b.maxZ);
        expect(SET_PIECES[p.piece]).toMatch(/\.glb$/);
      }
    }
  });

  it("never stack two pieces on the same half block", () => {
    for (const zone of ZONE_ORDER) {
      const seen = new Set<string>();
      for (const p of planSetPieces(zone, empty(zone))) {
        const key = `${p.block}:${p.rect.minZ}:${p.rect.maxZ}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("give each neighborhood its signature pieces", () => {
    const has = (zone: (typeof ZONE_ORDER)[number], id: string) =>
      planSetPieces(zone, empty(zone)).some((p) => p.piece === id);
    expect(has("rio", "tacoLot")).toBe(true);
    expect(has("rio", "palmPark")).toBe(true);
    expect(has("south", "liquorCorner")).toBe(true);
    expect(has("reservoir", "storefrontChurch")).toBe(true);
    expect(has("downtown", "transitPlaza")).toBe(true);
  });

  it("put the Nawf underpass on the El, away from the station", () => {
    const d = DISTRICTS.nawf;
    const trainZ = d.minZ + (d.maxZ - d.minZ) * 0.33;
    const u = planUnderpass(districtGrid("nawf").blocks, trainZ, 0)!;
    expect(u.piece).toBe("elUnderpass");
    expect((u.rect.minZ + u.rect.maxZ) / 2).toBeCloseTo(trainZ);
    expect(Math.abs((u.rect.minX + u.rect.maxX) / 2)).toBeGreaterThan(5);
  });
});
