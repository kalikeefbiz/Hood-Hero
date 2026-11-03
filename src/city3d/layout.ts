import type { ZoneId } from "../core/GameState";
import type { ActionCategory } from "../ui/ActionsHub";

// World layout for the 3D city board. It deliberately mirrors the existing
// 2D CityMap (420 × 390 SVG units) so both views describe the same Stixx City:
// The Nawf north, The Resevoir west, Downtown centre, Rio Gabriel east and
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
  resevoir: rect(12, 122, 135, 130),
  downtown: rect(160, 122, 100, 130),
  rio: rect(273, 122, 135, 130),
  south: rect(120, 274, 170, 100),
};
export const ZONE_ORDER: ZoneId[] = [
  "nawf",
  "resevoir",
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

export type LandmarkTarget =
  | { kind: "actions"; group: ActionCategory }
  | { kind: "people" }
  | { kind: "wallet" }
  | { kind: "politics" };
export interface LandmarkDefinition {
  id: string;
  zone: ZoneId;
  name: string;
  kind:
    | "civic"
    | "police"
    | "work"
    | "business"
    | "community"
    | "street"
    | "transit"
    | "home";
  description: string;
  /** Normalised position inside the district: 0..1 on each axis. */
  at: [number, number];
  target: LandmarkTarget;
  targetLabel: string;
  /** An existing BUSINESSES definition id, when this place is a business. */
  business?: string;
  /** An existing JOBS id, when this place hires. */
  job?: string;
}

// Places are fictional and intentionally abstract. Each one routes to a game
// system that already exists; none invents new rules.
export const LANDMARKS: LandmarkDefinition[] = [
  {
    id: "city-hall",
    zone: "downtown",
    name: "Stixx City Hall",
    kind: "civic",
    description:
      "Politicians, permits and the people who decide which blocks get attention.",
    at: [0.3, 0.58],
    target: { kind: "politics" },
    targetLabel: "Read Downtown politics",
  },
  {
    id: "central-precinct",
    zone: "downtown",
    name: "Central Precinct",
    kind: "police",
    description:
      "The city’s heaviest police presence works out of this building.",
    at: [0.72, 0.78],
    target: { kind: "politics" },
    targetLabel: "Check police presence",
  },
  {
    id: "courier-depot",
    zone: "downtown",
    name: "Courier route depot",
    kind: "business",
    business: "courier",
    description: "A licensed delivery route exposed to commercial demand.",
    at: [0.74, 0.4],
    target: { kind: "wallet" },
    targetLabel: "View in Wallet",
  },
  {
    id: "downtown-retail",
    zone: "downtown",
    name: "Downtown storefronts",
    kind: "work",
    job: "retail-downtown",
    description:
      "Retail counters along the commercial strip. They hire locals.",
    at: [0.38, 0.86],
    target: { kind: "actions", group: "Honest" },
    targetLabel: "Look for honest work",
  },
  {
    id: "the-towers",
    zone: "south",
    name: "The Towers",
    kind: "home",
    description: "Central project housing. Old loyalties live on every floor.",
    at: [0.5, 0.42],
    target: { kind: "people" },
    targetLabel: "Meet local people",
  },
  {
    id: "repair-counter",
    zone: "south",
    name: "Southside repair counter",
    kind: "business",
    business: "repair",
    description: "A modest repair concession with steady overhead.",
    at: [0.2, 0.74],
    target: { kind: "wallet" },
    targetLabel: "View in Wallet",
  },
  {
    id: "back-street-corner",
    zone: "south",
    name: "Back Street corner",
    kind: "street",
    description: "Where word moves fastest on the Southside.",
    at: [0.82, 0.72],
    target: { kind: "actions", group: "Streets" },
    targetLabel: "Open street moves",
  },
  {
    id: "south-retail",
    zone: "south",
    name: "Corner market",
    kind: "work",
    job: "retail-south",
    description: "A neighborhood shop that needs reliable hands.",
    at: [0.62, 0.86],
    target: { kind: "actions", group: "Honest" },
    targetLabel: "Look for honest work",
  },
  {
    id: "laundry",
    zone: "resevoir",
    name: "Resevoir laundry",
    kind: "business",
    business: "laundry",
    description: "A neighborhood laundry lease with real local demand.",
    at: [0.66, 0.68],
    target: { kind: "wallet" },
    targetLabel: "View in Wallet",
  },
  {
    id: "warehouse",
    zone: "resevoir",
    name: "Westside warehouse",
    kind: "work",
    job: "warehouse",
    description: "Deliveries sorted and moved. Applications open citywide.",
    at: [0.22, 0.86],
    target: { kind: "actions", group: "Honest" },
    targetLabel: "Look for honest work",
  },
  {
    id: "lot-court",
    zone: "resevoir",
    name: "The lot court",
    kind: "community",
    description: "A hoop on a vacant lot. Block Boys’ roots run through here.",
    at: [0.5, 0.42],
    target: { kind: "people" },
    targetLabel: "Meet local people",
  },
  {
    id: "resevoir-retail",
    zone: "resevoir",
    name: "Resevoir corner store",
    kind: "work",
    job: "retail-resevoir",
    description: "Shelves to stock and customers who know your face.",
    at: [0.82, 0.3],
    target: { kind: "actions", group: "Honest" },
    targetLabel: "Look for honest work",
  },
  {
    id: "lowrider-garage",
    zone: "rio",
    name: "Lowrider garage",
    kind: "community",
    description: "Chrome, hydraulics and the people Gabriel’s Angels count on.",
    at: [0.3, 0.6],
    target: { kind: "people" },
    targetLabel: "Meet local people",
  },
  {
    id: "rio-mercado",
    zone: "rio",
    name: "Mercado on the river",
    kind: "work",
    job: "retail-rio",
    description: "A family market with steady customers and long days.",
    at: [0.66, 0.78],
    target: { kind: "actions", group: "Honest" },
    targetLabel: "Look for honest work",
  },
  {
    id: "rio-mural",
    zone: "rio",
    name: "River wall mural",
    kind: "street",
    description: "The Eastside black market runs quieter than it looks.",
    at: [0.78, 0.36],
    target: { kind: "actions", group: "Streets" },
    targetLabel: "Open street moves",
  },
  {
    id: "nawf-bodega",
    zone: "nawf",
    name: "The bodega",
    kind: "work",
    job: "retail-nawf",
    description: "Yellow awning, open late, hiring when trust allows.",
    at: [0.3, 0.62],
    target: { kind: "actions", group: "Honest" },
    targetLabel: "Look for honest work",
  },
  {
    id: "memorial",
    zone: "nawf",
    name: "The memorial wall",
    kind: "community",
    description:
      "A Mudgang memorial, defaced in Blips purple. Residents want the feud to end.",
    at: [0.16, 0.34],
    target: { kind: "people" },
    targetLabel: "Meet local people",
  },
  {
    id: "el-station",
    zone: "nawf",
    name: "Nawf El station",
    kind: "transit",
    description: "Under the train tracks, the Nawf’s street economy moves.",
    at: [0.7, 0.3],
    target: { kind: "actions", group: "Streets" },
    targetLabel: "Open street moves",
  },
];
export const landmarkPosition = (l: LandmarkDefinition): [number, number] => {
  const d = DISTRICTS[l.zone];
  return [
    d.minX + (d.maxX - d.minX) * l.at[0],
    d.minZ + (d.maxZ - d.minZ) * l.at[1],
  ];
};
