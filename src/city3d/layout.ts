import type { ZoneId } from "../core/GameState";
import type { LocationDef } from "../board/locations";

// World layout for the 3D city board. It deliberately mirrors the existing
// 2D CityMap (420 × 390 SVG units) so both views describe the same Stixx City:
// The Nawf north, The Reservoir west, Downtown centre, Rio Gabriel east and
// Southside south, with the river winding from the southwest to the northeast.
export const SVG_SCALE = 0.5;
export const toWorld = (x: number, y: number): [number, number] => [
  (x - 210) * SVG_SCALE,
  (y - 195) * SVG_SCALE,
];

export interface DistrictRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const rect = (x: number, y: number, w: number, h: number): DistrictRect => {
  const [minX, minZ] = toWorld(x, y),
    [maxX, maxZ] = toWorld(x + w, y + h);
  return { minX, maxX, minZ, maxZ };
};
// Same rectangles as CityMap.tsx.
export const DISTRICTS: Record<ZoneId, DistrictRect> = {
  nawf: rect(120, 12, 170, 88),
  reservoir: rect(12, 122, 135, 130),
  downtown: rect(160, 122, 100, 130),
  rio: rect(273, 122, 135, 130),
  south: rect(120, 274, 170, 100),
};
export const ZONE_ORDER: ZoneId[] = [
  "nawf",
  "reservoir",
  "downtown",
  "rio",
  "south",
];
export const districtCenter = (z: ZoneId): [number, number] => {
  const d = DISTRICTS[z];
  return [(d.minX + d.maxX) / 2, (d.minZ + d.maxZ) / 2];
};
export const zoneAt = (x: number, z: number): ZoneId | null => {
  for (const id of ZONE_ORDER) {
    const d = DISTRICTS[id];
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return id;
  }
  return null;
};

// The CityMap river path, M5 320 C85 290 25 180 90 130 S290 170 330 70
// S400 50 419 0, expanded into explicit cubic segments.
const RIVER_SEGMENTS: [number, number][][] = [
  [
    [5, 320],
    [85, 290],
    [25, 180],
    [90, 130],
  ],
  [
    [90, 130],
    [155, 80],
    [290, 170],
    [330, 70],
  ],
  [
    [330, 70],
    [370, -30],
    [400, 50],
    [419, 0],
  ],
];
export const RIVER_WIDTH = 8;
export function riverPath(samplesPerSegment = 28): [number, number][] {
  const out: [number, number][] = [];
  // Extend beyond the board on both ends so the river leaves the city.
  out.push(toWorld(-60, 360));
  for (const [p0, p1, p2, p3] of RIVER_SEGMENTS)
    for (let i = 0; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment,
        u = 1 - t;
      const x =
        u * u * u * p0[0] +
        3 * u * u * t * p1[0] +
        3 * u * t * t * p2[0] +
        t * t * t * p3[0];
      const y =
        u * u * u * p0[1] +
        3 * u * u * t * p1[1] +
        3 * u * t * t * p2[1] +
        t * t * t * p3[1];
      out.push(toWorld(x, y));
    }
  out.push(toWorld(470, -60));
  return out;
}
export function distanceToPath(path: [number, number][], x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i],
      [bx, bz] = path[i + 1];
    const dx = bx - ax,
      dz = bz - az,
      len = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len));
    const px = ax + t * dx - x,
      pz = az + t * dz - z;
    best = Math.min(best, Math.sqrt(px * px + pz * pz));
  }
  return best;
}

// Avenues follow the 2D map's dividing lines.
export const AVENUES_X = [toWorld(153, 0)[0], toWorld(267, 0)[0]];
export const AVENUES_Z = [toWorld(0, 110)[1], toWorld(0, 264)[1]];
export const BOARD = { minX: -112, maxX: 112, minZ: -104, maxZ: 104 };

// Block grid per district, shared by the renderer, the board UI and tests.
export const STREET = 3.2;
export const DISTRICT_INSET = 1.2;
export const BLOCK_SIZE: Record<ZoneId, number> = {
  downtown: 11,
  nawf: 11,
  south: 12,
  reservoir: 12,
  rio: 11,
};
export interface BlockDef {
  /** Stable id, e.g. "south.b3-1" (column-row). */
  id: string;
  zone: ZoneId;
  col: number;
  row: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** True when the river runs through it (promenade / docks, no buildings). */
  waterfront: boolean;
}
const RIVER = riverPath();
export function districtGrid(zone: ZoneId) {
  const d = DISTRICTS[zone];
  const W = d.maxX - d.minX - DISTRICT_INSET * 2,
    D = d.maxZ - d.minZ - DISTRICT_INSET * 2,
    size = BLOCK_SIZE[zone];
  const nx = Math.max(1, Math.round((W + STREET) / (size + STREET))),
    nz = Math.max(1, Math.round((D + STREET) / (size + STREET)));
  const bw = (W - (nx - 1) * STREET) / nx,
    bd = (D - (nz - 1) * STREET) / nz;
  const blocks: BlockDef[] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const minX = d.minX + DISTRICT_INSET + i * (bw + STREET),
        minZ = d.minZ + DISTRICT_INSET + j * (bd + STREET);
      const cx = minX + bw / 2,
        cz = minZ + bd / 2;
      blocks.push({
        id: `${zone}.b${i}-${j}`,
        zone,
        col: i,
        row: j,
        minX,
        maxX: minX + bw,
        minZ,
        maxZ: minZ + bd,
        waterfront:
          distanceToPath(RIVER, cx, cz) < RIVER_WIDTH / 2 + Math.max(bw, bd) * 0.42,
      });
    }
  const xs: number[] = [],
    zs: number[] = [];
  for (let i = 1; i < nx; i++)
    xs.push(d.minX + DISTRICT_INSET + i * bw + (i - 0.5) * STREET);
  for (let j = 1; j < nz; j++)
    zs.push(d.minZ + DISTRICT_INSET + j * bd + (j - 0.5) * STREET);
  return { blocks, nx, nz, bw, bd, streetsX: xs, streetsZ: zs };
}
export const ALL_BLOCKS: BlockDef[] = (
  ["nawf", "reservoir", "downtown", "rio", "south"] as ZoneId[]
).flatMap((z) => districtGrid(z).blocks);
export const blockAt = (x: number, z: number) =>
  ALL_BLOCKS.find(
    (b) => x >= b.minX - 1.6 && x <= b.maxX + 1.6 && z >= b.minZ - 1.6 && z <= b.maxZ + 1.6,
  ) ?? null;
export const blockById = (id: string) => ALL_BLOCKS.find((b) => b.id === id);

export const locationPosition = (l: Pick<LocationDef, "zone" | "at">): [number, number] => {
  const d = DISTRICTS[l.zone];
  return [
    d.minX + (d.maxX - d.minX) * l.at[0],
    d.minZ + (d.maxZ - d.minZ) * l.at[1],
  ];
};
export const locationBlock = (l: Pick<LocationDef, "zone" | "at">) => {
  const [x, z] = locationPosition(l);
  return blockAt(x, z);
};
