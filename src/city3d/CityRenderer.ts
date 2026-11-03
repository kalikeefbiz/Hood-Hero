import * as THREE from "three";
import type { ZoneId } from "../core/GameState";
import {
  AVENUES_X,
  AVENUES_Z,
  BOARD,
  DISTRICTS,
  LANDMARKS,
  RIVER_WIDTH,
  ZONE_ORDER,
  districtCenter,
  distanceToPath,
  landmarkPosition,
  riverPath,
  type DistrictRect,
  type LandmarkDefinition,
} from "./layout";
import type { CityView, ZoneView } from "./viewModel";

// ---------------------------------------------------------------------------
// Stixx City renderer. Procedural, asset-free and built for iPhone Safari:
// static geometry is merged per district, moving things are instanced, the
// shadow map is baked once per lighting change, and rendering pauses when the
// board is off screen or the tab is hidden.
// ---------------------------------------------------------------------------

export type TimeOfDay = "dusk" | "night" | "day";
export interface PickResult {
  zone: ZoneId | null;
  landmark: string | null;
}
export interface OverlayAnchor {
  key: string;
  element: HTMLElement;
  position: THREE.Vector3;
  /** Hide when the camera is farther than this distance. */
  maxDistance?: number;
  /** Hide when the camera is closer than this distance. */
  minDistance?: number;
}

type V3 = [number, number, number];
type Lit = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
const FLOOR = 0.9,
  BAY = 0.9,
  TILE = 16,
  CURB = 0.25;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, list: readonly T[]) =>
  list[Math.floor(r() * list.length) % list.length];
const col = (hex: string) => new THREE.Color(hex);

/** Accumulates triangles so a whole district becomes one draw call. */
class Geo {
  p: number[] = [];
  n: number[] = [];
  u: number[] = [];
  c: number[] = [];
  get empty() {
    return this.p.length === 0;
  }
  private vert(pt: V3, nn: V3, uv: [number, number], cl: THREE.Color) {
    this.p.push(pt[0], pt[1], pt[2]);
    this.n.push(nn[0], nn[1], nn[2]);
    this.u.push(uv[0], uv[1]);
    this.c.push(cl.r, cl.g, cl.b);
  }
  tri(a: V3, b: V3, c: V3, cl: THREE.Color) {
    const n = normal(a, b, c);
    this.vert(a, n, [0, 0], cl);
    this.vert(b, n, [0, 0], cl);
    this.vert(c, n, [0, 0], cl);
  }
  quad(
    a: V3,
    b: V3,
    c: V3,
    d: V3,
    cl: THREE.Color,
    uv: [number, number, number, number] = [0, 0, 0, 0],
  ) {
    const n = normal(a, b, d);
    const [u0, v0, u1, v1] = uv;
    this.vert(a, n, [u0, v0], cl);
    this.vert(b, n, [u1, v0], cl);
    this.vert(c, n, [u1, v1], cl);
    this.vert(a, n, [u0, v0], cl);
    this.vert(c, n, [u1, v1], cl);
    this.vert(d, n, [u0, v1], cl);
  }
  geometry(g: THREE.BufferGeometry, m: THREE.Matrix4, cl: THREE.Color) {
    const src = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    const pos = src.getAttribute("position"),
      nor = src.getAttribute("normal");
    for (let i = 0; i < pos.count; i++) {
      this.p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      this.n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      this.u.push(0, 0);
      this.c.push(cl.r, cl.g, cl.b);
    }
    src.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}
function normal(a: V3, b: V3, c: V3): V3 {
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2],
    vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  const x = uy * vz - uz * vy,
    y = uz * vx - ux * vz,
    z = ux * vy - uy * vx,
    l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

interface Kit {
  facade: Geo;
  plain: Geo;
  glow: Geo;
  roofs: V3[];
  r: () => number;
}
interface BoxOptions {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  y?: number;
  rot?: number;
  color: THREE.Color;
  roof?: THREE.Color;
  windows?: boolean;
  noRoofRecord?: boolean;
}
function box(k: Kit, o: BoxOptions) {
  const y0 = o.y ?? CURB,
    y1 = y0 + o.h,
    rot = o.rot ?? 0,
    cs = Math.cos(rot),
    sn = Math.sin(rot);
  const at = (lx: number, lz: number, y: number): V3 => [
    o.x + lx * cs + lz * sn,
    y,
    o.z - lx * sn + lz * cs,
  ];
  const hw = o.w / 2,
    hd = o.d / 2;
  const corners: [number, number][] = [
    [-hw, -hd],
    [-hw, hd],
    [hw, hd],
    [hw, -hd],
  ];
  const uo = Math.floor(k.r() * TILE) / TILE,
    vo = Math.floor(k.r() * TILE) / TILE;
  const target = o.windows === false ? k.plain : k.facade;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i],
      [bx, bz] = corners[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    target.quad(
      at(ax, az, y0),
      at(bx, bz, y0),
      at(bx, bz, y1),
      at(ax, az, y1),
      o.color,
      [
        uo,
        vo + y0 / (FLOOR * TILE),
        uo + len / (BAY * TILE),
        vo + y1 / (FLOOR * TILE),
      ],
    );
  }
  k.plain.quad(
    at(corners[0][0], corners[0][1], y1),
    at(corners[1][0], corners[1][1], y1),
    at(corners[2][0], corners[2][1], y1),
    at(corners[3][0], corners[3][1], y1),
    o.roof ?? o.color.clone().multiplyScalar(0.62),
  );
  if (!o.noRoofRecord && o.h > 1.2) k.roofs.push([o.x, y1, o.z]);
  return y1;
}
function gable(
  k: Kit,
  x: number,
  z: number,
  w: number,
  d: number,
  y: number,
  rh: number,
  rot: number,
  cl: THREE.Color,
) {
  const cs = Math.cos(rot),
    sn = Math.sin(rot);
  const at = (lx: number, ly: number, lz: number): V3 => [
    x + lx * cs + lz * sn,
    ly,
    z - lx * sn + lz * cs,
  ];
  const hw = w / 2 + 0.12,
    hd = d / 2 + 0.12;
  const A = at(-hw, y, -hd),
    B = at(hw, y, -hd),
    C = at(hw, y, hd),
    D = at(-hw, y, hd),
    R1 = at(-hw, y + rh, 0),
    R2 = at(hw, y + rh, 0);
  k.plain.quad(B, A, R1, R2, cl);
  k.plain.quad(D, C, R2, R1, cl);
  const end = cl.clone().multiplyScalar(1.25);
  k.plain.tri(
    at(-w / 2, y, -d / 2),
    at(-w / 2, y, d / 2),
    at(-w / 2, y + rh, 0),
    end,
  );
  k.plain.tri(
    at(w / 2, y, d / 2),
    at(w / 2, y, -d / 2),
    at(w / 2, y + rh, 0),
    end,
  );
}
const M = new THREE.Matrix4(),
  Q = new THREE.Quaternion(),
  S = new THREE.Vector3(),
  P = new THREE.Vector3(),
  E = new THREE.Euler();
function placed(
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  ry = 0,
) {
  Q.setFromEuler(E.set(0, ry, 0));
  // Callers consume the matrix immediately, so one shared instance avoids
  // per-frame allocations in the animation loop.
  return M.compose(P.set(x, y, z), Q, S.set(sx, sy, sz));
}
const CYL = new THREE.CylinderGeometry(1, 1, 1, 7, 1),
  CONE = new THREE.ConeGeometry(1, 1, 6, 1),
  BLOB = new THREE.IcosahedronGeometry(1, 0),
  DOME = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
function tree(k: Kit, x: number, z: number, scale = 1, bare = false) {
  const h = (1.2 + k.r() * 0.8) * scale;
  k.plain.geometry(
    CYL,
    placed(x, CURB + h / 2, z, 0.1, h, 0.1),
    col("#4a3a2c"),
  );
  if (bare) {
    k.plain.geometry(
      CONE,
      placed(
        x,
        CURB + h + 0.4 * scale,
        z,
        0.75 * scale,
        1.6 * scale,
        0.75 * scale,
      ),
      col("#3b322c"),
    );
    return;
  }
  const g = pick(k.r, ["#3f5a35", "#4c6338", "#36502f"]);
  k.plain.geometry(
    BLOB,
    placed(
      x,
      CURB + h + 0.5 * scale,
      z,
      0.95 * scale,
      0.85 * scale,
      0.95 * scale,
      k.r() * 3,
    ),
    col(g),
  );
}
function palm(k: Kit, x: number, z: number) {
  const h = 3.6 + k.r() * 1.8;
  k.plain.geometry(
    CYL,
    placed(x, CURB + h / 2, z, 0.09, h, 0.09),
    col("#6b5640"),
  );
  for (let i = 0; i < 5; i++)
    k.plain.geometry(
      CONE,
      placed(x, CURB + h - 0.1, z, 0.22, 1.5, 0.22, 0).multiply(
        new THREE.Matrix4().makeRotationFromEuler(
          new THREE.Euler(Math.PI / 2.4, (i / 5) * Math.PI * 2, 0, "YXZ"),
        ),
      ),
      col("#4f6b3a"),
    );
}
function carBody(
  k: Kit,
  x: number,
  z: number,
  rot: number,
  hex: string,
  low = false,
) {
  const c = col(hex);
  box(k, {
    x,
    z,
    w: 1.5,
    d: 0.7,
    h: low ? 0.28 : 0.36,
    y: 0.08,
    rot,
    color: c,
    windows: false,
    noRoofRecord: true,
  });
  box(k, {
    x: x + Math.cos(rot) * -0.1,
    z: z - Math.sin(rot) * -0.1,
    w: 0.75,
    d: 0.6,
    h: 0.26,
    y: low ? 0.36 : 0.44,
    rot,
    color: col("#1b2027"),
    windows: false,
    noRoofRecord: true,
  });
}

// --- textures -----------------------------------------------------------------
function canvas(size: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!);
  return c;
}
function facadeTextures() {
  const cell = 32,
    size = cell * TILE,
    r = rng(7);
  const lit: boolean[] = [];
  for (let i = 0; i < TILE * TILE; i++) lit.push(r() < 0.34);
  const map = new THREE.CanvasTexture(
    canvas(size, (g) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, size, size);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          g.fillStyle = "#e9e6e1";
          g.fillRect(x * cell, y * cell + cell - 3, cell, 3);
          g.fillStyle = lit[y * TILE + x] ? "#5b5348" : "#30353d";
          g.fillRect(x * cell + 8, y * cell + 7, 16, 17);
        }
    }),
  );
  const emissive = new THREE.CanvasTexture(
    canvas(size, (g) => {
      g.fillStyle = "#000";
      g.fillRect(0, 0, size, size);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++)
          if (lit[y * TILE + x]) {
            const warm = r();
            g.fillStyle =
              warm < 0.7 ? "#ffc27a" : warm < 0.9 ? "#ffe2b0" : "#9fc8ff";
            g.fillRect(x * cell + 8, y * cell + 7, 16, 17);
          }
    }),
  );
  for (const t of [map, emissive]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}
function radialTexture() {
  const t = new THREE.CanvasTexture(
    canvas(64, (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }),
  );
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function muralTexture() {
  const t = new THREE.CanvasTexture(
    canvas(128, (g) => {
      const grad = g.createLinearGradient(0, 0, 128, 0);
      grad.addColorStop(0, "#2f6f8f");
      grad.addColorStop(0.5, "#d9604b");
      grad.addColorStop(1, "#e9be39");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = "rgba(255,240,220,0.85)";
      g.beginPath();
      g.ellipse(64, 58, 22, 30, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c2344a";
      for (const [x, y] of [
        [22, 96],
        [104, 92],
        [36, 30],
      ]) {
        g.beginPath();
        g.arc(x, y, 12, 0, Math.PI * 2);
        g.fill();
      }
    }),
  );
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- lighting presets -----------------------------------------------------------
const TIMES: Record<
  TimeOfDay,
  {
    top: string;
    horizon: string;
    sun: string;
    sunIntensity: number;
    sunDir: V3;
    hemiSky: string;
    hemiGround: string;
    hemi: number;
    fog: string;
    windows: number;
    lamps: number;
    exposure: number;
  }
> = {
  dusk: {
    top: "#2a2350",
    horizon: "#f2925a",
    sun: "#ffb27a",
    sunIntensity: 3.4,
    sunDir: [-0.72, 0.46, -0.52],
    hemiSky: "#c39ac0",
    hemiGround: "#5a4038",
    hemi: 1.7,
    fog: "#b07a78",
    windows: 1,
    lamps: 0.8,
    exposure: 1.3,
  },
  night: {
    top: "#05070f",
    horizon: "#1f2848",
    sun: "#9fb4e6",
    sunIntensity: 0.9,
    sunDir: [0.45, 0.6, -0.4],
    hemiSky: "#4a5a8a",
    hemiGround: "#16141c",
    hemi: 0.9,
    fog: "#1a2238",
    windows: 1.8,
    lamps: 1,
    exposure: 1.3,
  },
  day: {
    top: "#5d8fcf",
    horizon: "#dfe6ea",
    sun: "#fff1dc",
    sunIntensity: 3,
    sunDir: [-0.4, 0.82, 0.35],
    hemiSky: "#c3d8ef",
    hemiGround: "#5c5a50",
    hemi: 1.6,
    fog: "#c3ced6",
    windows: 0.05,
    lamps: 0,
    exposure: 1,
  },
};

const DISTRICT_STYLE: Record<
  ZoneId,
  { block: number; walls: string[]; sidewalk: string; trees: number }
> = {
  downtown: {
    block: 11,
    walls: ["#c9c2b4", "#8fa3b5", "#6f8296", "#b4ab9b", "#a6b6c4", "#d6cfc0"],
    sidewalk: "#8b8a86",
    trees: 0.25,
  },
  nawf: {
    block: 11,
    walls: ["#8a4a36", "#9b5a3e", "#7a3f30", "#b0805c", "#6e3b2f", "#a8664a"],
    sidewalk: "#7f7b76",
    trees: 0.3,
  },
  south: {
    block: 12,
    walls: ["#7c4434", "#8c5442", "#6a3c32", "#9a6a52", "#5e3a31"],
    sidewalk: "#6f6c68",
    trees: 0.45,
  },
  resevoir: {
    block: 12,
    walls: ["#b9b2a2", "#8d9a9a", "#a69683", "#c2b08c", "#7f8b84", "#9e8a7c"],
    sidewalk: "#75736c",
    trees: 0.7,
  },
  rio: {
    block: 11,
    walls: [
      "#d9a185",
      "#c97d63",
      "#e3b98f",
      "#b86a5a",
      "#e0c8a0",
      "#c98f6a",
      "#9fb7a6",
    ],
    sidewalk: "#8f857a",
    trees: 0.5,
  },
};

interface Mover {
  path: [number, number][];
  lengths: number[];
  total: number;
  t: number;
  speed: number;
  y: number;
}
function loop(path: [number, number][]): Omit<Mover, "t" | "speed" | "y"> {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length; i++) {
    const [ax, az] = path[i],
      [bx, bz] = path[(i + 1) % path.length];
    const l = Math.hypot(bx - ax, bz - az);
    lengths.push(l);
    total += l;
  }
  return { path, lengths, total };
}
function sample(m: Mover, out: { x: number; z: number; heading: number }) {
  let d = ((m.t % m.total) + m.total) % m.total;
  for (let i = 0; i < m.path.length; i++) {
    if (d <= m.lengths[i]) {
      const [ax, az] = m.path[i],
        [bx, bz] = m.path[(i + 1) % m.path.length];
      const f = m.lengths[i] ? d / m.lengths[i] : 0;
      out.x = ax + (bx - ax) * f;
      out.z = az + (bz - az) * f;
      out.heading = Math.atan2(-(bz - az), bx - ax);
      return out;
    }
    d -= m.lengths[i];
  }
  return out;
}
const rectLoop = (
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): [number, number][] => [
  [minX, minZ],
  [maxX, minZ],
  [maxX, maxZ],
  [minX, maxZ],
];

interface BlockInfo {
  zone: ZoneId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export class CityRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 1, 900);
  onPick: (r: PickResult) => void = () => {};
  onInteract: () => void = () => {};

  private host: HTMLElement;
  private river = riverPath();
  private textures = facadeTextures();
  private glowTex = radialTexture();
  private facadeMat!: Lit;
  private plainMat!: Lit;
  private glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  private groundMat!: Lit;
  private waterMat!: Lit;
  private lampPoolMat = new THREE.MeshBasicMaterial({
    map: this.glowTex,
    color: "#ffb36b",
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private lampHeadMat = new THREE.MeshBasicMaterial({
    color: "#ffd9a0",
    toneMapped: false,
  });
  private sun = new THREE.DirectionalLight("#ffffff", 2);
  private hemi = new THREE.HemisphereLight("#ffffff", "#333333", 1);
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private pickers: THREE.Mesh[] = [];
  private districtPickers: THREE.Mesh[] = [];
  private blocks: BlockInfo[] = [];
  private innerStreets: Record<ZoneId, { xs: number[]; zs: number[] }> = {
    downtown: { xs: [], zs: [] },
    nawf: { xs: [], zs: [] },
    south: { xs: [], zs: [] },
    resevoir: { xs: [], zs: [] },
    rio: { xs: [], zs: [] },
  };
  private roofs: Record<ZoneId, V3[]> = {
    downtown: [],
    nawf: [],
    south: [],
    resevoir: [],
    rio: [],
  };
  private dynamic = new THREE.Group();
  private animated: ((t: number, dt: number) => void)[] = [];
  private dynamicAnimated: ((t: number, dt: number) => void)[] = [];
  private overlays: OverlayAnchor[] = [];
  private view: CityView | null = null;
  private selected: ZoneId | null = null;
  private selectedLandmark: string | null = null;
  private time: TimeOfDay = "dusk";
  private trainZ = 0;

  // Camera rig
  private target = new THREE.Vector3(0, 0, 12);
  private distance = 205;
  private yaw = 0;
  private flight: {
    from: { x: number; z: number; d: number; yaw: number };
    to: { x: number; z: number; d: number; yaw: number };
    t: number;
  } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: {
    startX: number;
    startY: number;
    moved: number;
    start: number;
    pinch?: { dist: number; angle: number; distance: number; yaw: number };
    groundStart?: THREE.Vector3;
    targetStart?: THREE.Vector3;
  } | null = null;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Loop control
  private frame = 0;
  private running = false;
  private visible = true;
  private lastFrame = 0;
  private lastActive = 0;
  private clock = 0;
  private observer: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private lite = false;
  private timeApplied = false;
  private reducedMotion = false;

  constructor(host: HTMLElement) {
    this.host = host;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer = new THREE.WebGLRenderer({
      antialias: dpr < 1.5,
      powerPreference: "high-performance",
    });
    // Software renderers (no GPU acceleration) can't afford continuous
    // animation: draw lighter and only animate while the city is touched.
    this.lite = isSoftwareRenderer(this.renderer);
    this.reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (this.lite) dpr = 1;
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = !this.lite;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    const el = this.renderer.domElement;
    el.className = "city3d-canvas";
    el.setAttribute("aria-hidden", "true");
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.makeMaterials();
    const buildStart = performance.now();

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(600, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          sunColor: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3() },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; varying vec3 vDir;
          void main(){ float h = clamp(vDir.y, -0.2, 1.0); vec3 c = mix(horizon, top, pow(max(h,0.0), 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0); c += sunColor * (pow(s, 48.0) * 1.2 + pow(s, 5.0) * 0.22);
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    );
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog("#000", 190, 520);

    const shadowSize = 1024;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = -125;
    sc.right = 125;
    sc.top = 125;
    sc.bottom = -125;
    sc.near = 10;
    sc.far = 420;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.4;
    this.scene.add(this.sun, this.sun.target, this.hemi);

    this.build();
    this.scene.add(this.dynamic);
    (window as unknown as { __stixxBuildMs?: number }).__stixxBuildMs =
      performance.now() - buildStart;
    this.setTimeOfDay("dusk");
    this.bindInput(el);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.attach(host);
  }

  private static instance: CityRenderer | null = null;
  /**
   * One city per page. Leaving the City screen detaches it instead of
   * destroying it, so coming back is instant and shaders compile only once.
   */
  static acquire(host: HTMLElement) {
    if (!CityRenderer.instance || CityRenderer.instance.disposed)
      CityRenderer.instance = new CityRenderer(host);
    else CityRenderer.instance.attach(host);
    return CityRenderer.instance;
  }
  attach(host: HTMLElement) {
    this.host = host;
    host.prepend(this.renderer.domElement);
    this.resizeObserver?.disconnect();
    this.observer?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.observer = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) this.start();
      },
      { threshold: 0.01 },
    );
    this.observer.observe(host);
    this.visible = true;
    this.resize();
    this.start();
  }
  detach() {
    cancelAnimationFrame(this.frame);
    this.running = false;
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.overlays = [];
    this.pointers.clear();
    this.gesture = null;
    this.renderer.domElement.remove();
    this.onPick = () => {};
    this.onInteract = () => {};
  }
  private makeMaterials() {
    // Software renderers get cheaper Lambert shading; GPUs get PBR.
    const lit = (o: THREE.MeshStandardMaterialParameters): Lit => {
      if (!this.lite) return new THREE.MeshStandardMaterial(o);
      const { roughness: _r, metalness: _m, ...rest } = o;
      void _r;
      void _m;
      return new THREE.MeshLambertMaterial(
        rest as THREE.MeshLambertMaterialParameters,
      );
    };
    this.facadeMat = lit({
      vertexColors: true,
      map: this.textures.map,
      emissiveMap: this.textures.emissive,
      emissive: new THREE.Color("#ffffff"),
      roughness: 0.82,
      metalness: 0.05,
    });
    this.plainMat = lit({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.02,
    });
    this.groundMat = lit({ color: "#34353a", roughness: 0.5, metalness: 0.15 });
    this.waterMat = lit({ color: "#1d3a44", roughness: 0.12, metalness: 0.7 });
  }

  // ---- public API --------------------------------------------------------------
  setView(view: CityView) {
    this.view = view;
    this.rebuildDynamic();
    this.wake();
  }
  setSelected(zone: ZoneId | null, fly = true) {
    const changed = this.selected !== zone;
    this.selected = zone;
    if (this.view) this.rebuildDynamic();
    if (fly && changed && zone) {
      const [x, z] = districtCenter(zone);
      this.flyTo(x, z + 6, zone === "downtown" ? 92 : 104);
    }
    this.wake();
  }
  setSelectedLandmark(id: string | null) {
    this.selectedLandmark = id;
    if (this.view) this.rebuildDynamic();
    const l = LANDMARKS.find((l) => l.id === id);
    if (l) {
      const [x, z] = landmarkPosition(l);
      this.flyTo(x, z + 4, 58);
    }
    this.wake();
  }
  overview() {
    this.flyTo(0, 12, 205, 0);
  }
  setTimeOfDay(time: TimeOfDay) {
    if (this.timeApplied && time === this.time) return;
    this.timeApplied = true;
    this.time = time;
    const t = TIMES[time];
    const u = this.sky.material.uniforms;
    (u.top.value as THREE.Color).set(t.top);
    (u.horizon.value as THREE.Color).set(t.horizon);
    (u.sunColor.value as THREE.Color).set(t.sun);
    (u.sunDir.value as THREE.Vector3).set(...t.sunDir).normalize();
    this.sun.color.set(t.sun);
    this.sun.intensity = t.sunIntensity;
    this.sun.position
      .set(...t.sunDir)
      .normalize()
      .multiplyScalar(220);
    this.sun.target.position.set(0, 0, 0);
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.hemi.intensity = t.hemi;
    (this.scene.fog as THREE.Fog).color.set(t.fog);
    this.facadeMat.emissiveIntensity = t.windows;
    this.glowMat.color.setScalar(time === "day" ? 0.55 : 1);
    this.lampPoolMat.opacity = 0.55 * t.lamps;
    this.lampHeadMat.color.set(t.lamps ? "#ffd9a0" : "#8c8a84");
    this.renderer.toneMappingExposure = t.exposure;
    // Reflections on wet streets and water come from the sky itself.
    if (!this.lite) {
      const envScene = new THREE.Scene();
      envScene.add(this.sky.clone());
      this.envTarget?.dispose();
      this.envTarget = this.pmrem.fromScene(envScene, 0.04);
      this.scene.environment = this.envTarget.texture;
      this.scene.environmentIntensity = time === "night" ? 0.5 : 0.85;
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.wake();
  }
  registerOverlay(anchor: OverlayAnchor) {
    this.overlays = this.overlays.filter((o) => o.key !== anchor.key);
    this.overlays.push(anchor);
    this.wake();
  }
  unregisterOverlay(key: string) {
    this.overlays = this.overlays.filter((o) => o.key !== key);
  }
  /** World position for an HTML label above a district or landmark. */
  static anchorFor(kind: "zone" | "landmark", id: string) {
    if (kind === "zone") {
      const [x, z] = districtCenter(id as ZoneId);
      return new THREE.Vector3(x, 26, z - 8);
    }
    const l = LANDMARKS.find((l) => l.id === id)!;
    const [x, z] = landmarkPosition(l);
    return new THREE.Vector3(x, landmarkHeight(l) + 2.2, z);
  }
  resize() {
    const w = this.host.clientWidth || 1,
      h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait phones get a wider lens so the board still reads as a city.
    this.camera.fov = w / h < 1 ? 52 : 40;
    this.camera.updateProjectionMatrix();
    this.wake();
  }
  dispose() {
    this.disposed = true;
    if (CityRenderer.instance === this) CityRenderer.instance = null;
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const m of [
      this.facadeMat,
      this.plainMat,
      this.glowMat,
      this.groundMat,
      this.waterMat,
      this.lampPoolMat,
      this.lampHeadMat,
      this.sky.material,
    ])
      m.dispose();
    this.textures.map.dispose();
    this.textures.emissive.dispose();
    this.glowTex.dispose();
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---- static city ---------------------------------------------------------------
  private build() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2),
      this.groundMat,
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.buildRiver();
    for (const zone of ZONE_ORDER) this.buildDistrict(zone);
    this.buildFiller();
    this.buildStreetFurniture();
    this.buildTraffic();
    for (const l of LANDMARKS) {
      const [x, z] = landmarkPosition(l),
        h = landmarkHeight(l);
      const picker = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.2, h + 2, 8).translate(
          0,
          (h + 2) / 2,
          0,
        ),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      picker.position.set(x, 0, z);
      picker.userData.landmark = l.id;
      this.pickers.push(picker);
      this.scene.add(picker);
    }
    for (const zone of ZONE_ORDER) {
      const d = DISTRICTS[zone];
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(d.maxX - d.minX, d.maxZ - d.minZ).rotateX(
          -Math.PI / 2,
        ),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      plane.position.set((d.minX + d.maxX) / 2, 0.4, (d.minZ + d.maxZ) / 2);
      plane.userData.zone = zone;
      this.districtPickers.push(plane);
      this.scene.add(plane);
    }
    this.renderer.shadowMap.needsUpdate = true;
  }
  private addKit(k: Kit, shadows = true) {
    const out: THREE.Mesh[] = [];
    if (!k.facade.empty)
      out.push(new THREE.Mesh(k.facade.build(), this.facadeMat));
    if (!k.plain.empty)
      out.push(new THREE.Mesh(k.plain.build(), this.plainMat));
    if (!k.glow.empty) out.push(new THREE.Mesh(k.glow.build(), this.glowMat));
    for (const m of out) {
      m.castShadow = shadows && m.material !== this.glowMat;
      m.receiveShadow = m.material !== this.glowMat;
      this.scene.add(m);
    }
  }
  private kit(seed: number): Kit {
    return {
      facade: new Geo(),
      plain: new Geo(),
      glow: new Geo(),
      roofs: [],
      r: rng(seed),
    };
  }
  private buildRiver() {
    const g = new Geo(),
      banks = this.kit(91),
      w = RIVER_WIDTH / 2,
      water = col("#ffffff"),
      wall = col("#5f5b55");
    const path = this.river;
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i],
        [bx, bz] = path[i + 1];
      const dx = bx - ax,
        dz = bz - az,
        l = Math.hypot(dx, dz) || 1,
        nx = -dz / l,
        nz = dx / l;
      // Slight overlap avoids cracks between segments.
      const ex = (dx / l) * 0.3,
        ez = (dz / l) * 0.3;
      g.quad(
        [ax + nx * w - ex, 0.06, az + nz * w - ez],
        [ax - nx * w - ex, 0.06, az - nz * w - ez],
        [bx - nx * w + ex, 0.06, bz - nz * w + ez],
        [bx + nx * w + ex, 0.06, bz + nz * w + ez],
        water,
      );
      for (const side of [1, -1]) {
        const ox = nx * (w + 0.35) * side,
          oz = nz * (w + 0.35) * side;
        box(banks, {
          x: (ax + bx) / 2 + ox,
          z: (az + bz) / 2 + oz,
          w: l + 0.4,
          d: 0.7,
          h: 0.55,
          y: 0,
          rot: Math.atan2(-dz, dx),
          color: wall,
          windows: false,
          noRoofRecord: true,
        });
      }
    }
    const waterGeo = g.build();
    waterGeo.deleteAttribute("color");
    const mesh = new THREE.Mesh(waterGeo, this.waterMat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    // Bridges where the river crosses each avenue and inner street.
    const crossings: { x: number; z: number; rot: number }[] = [];
    const lines: { axis: "x" | "z"; v: number }[] = [
      ...AVENUES_X.map((v) => ({ axis: "x" as const, v })),
      ...AVENUES_Z.map((v) => ({ axis: "z" as const, v })),
    ];
    for (const line of lines)
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i],
          b = path[i + 1];
        const ai = line.axis === "x" ? a[0] : a[1],
          bi = line.axis === "x" ? b[0] : b[1];
        if ((ai - line.v) * (bi - line.v) > 0 || ai === bi) continue;
        const f = (line.v - ai) / (bi - ai);
        const x = a[0] + (b[0] - a[0]) * f,
          z = a[1] + (b[1] - a[1]) * f;
        if (Math.abs(x) > 120 || Math.abs(z) > 110) continue;
        crossings.push({ x, z, rot: line.axis === "x" ? Math.PI / 2 : 0 });
      }
    for (const c of crossings) {
      box(banks, {
        x: c.x,
        z: c.z,
        w: RIVER_WIDTH + 5,
        d: 4.2,
        h: 0.35,
        y: 0.45,
        rot: c.rot,
        color: col("#4c4d50"),
        windows: false,
        noRoofRecord: true,
      });
      for (const side of [-1, 1])
        box(banks, {
          x: c.x + (c.rot ? side * 2 : 0),
          z: c.z + (c.rot ? 0 : side * 2),
          w: RIVER_WIDTH + 5,
          d: 0.18,
          h: 0.5,
          y: 0.8,
          rot: c.rot,
          color: col("#7b6f62"),
          windows: false,
          noRoofRecord: true,
        });
    }
    this.addKit(banks);
  }
  private nearRiver(x: number, z: number, pad: number) {
    return distanceToPath(this.river, x, z) < RIVER_WIDTH / 2 + pad;
  }
  private buildDistrict(zone: ZoneId) {
    const d = DISTRICTS[zone],
      style = DISTRICT_STYLE[zone],
      k = this.kit(zone.length * 977 + zone.charCodeAt(0) * 13),
      street = 3.2,
      inset = 1.2;
    const W = d.maxX - d.minX - inset * 2,
      D = d.maxZ - d.minZ - inset * 2;
    const nx = Math.max(1, Math.round((W + street) / (style.block + street))),
      nz = Math.max(1, Math.round((D + street) / (style.block + street)));
    const bw = (W - (nx - 1) * street) / nx,
      bd = (D - (nz - 1) * street) / nz;
    const reserved = LANDMARKS.filter((l) => l.zone === zone);
    const trainZ =
      zone === "nawf" ? d.minZ + (d.maxZ - d.minZ) * 0.3 : Number.NaN;
    if (zone === "nawf") this.trainZ = trainZ;
    for (let i = 1; i < nx; i++)
      this.innerStreets[zone].xs.push(
        d.minX + inset + i * bw + (i - 0.5) * street,
      );
    for (let j = 1; j < nz; j++)
      this.innerStreets[zone].zs.push(
        d.minZ + inset + j * bd + (j - 0.5) * street,
      );
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const minX = d.minX + inset + i * (bw + street),
          minZ = d.minZ + inset + j * (bd + street);
        const b = { zone, minX, maxX: minX + bw, minZ, maxZ: minZ + bd };
        const cx = (b.minX + b.maxX) / 2,
          cz = (b.minZ + b.maxZ) / 2;
        if (this.nearRiver(cx, cz, Math.max(bw, bd) * 0.42)) {
          this.waterfront(k, zone, b);
          continue;
        }
        this.blocks.push(b);
        // Sidewalk slab.
        box(k, {
          x: cx,
          z: cz,
          w: bw,
          d: bd,
          h: CURB,
          y: 0,
          color: col(style.sidewalk),
          windows: false,
          noRoofRecord: true,
        });
        const landmark = reserved.find((l) => {
          const [lx, lz] = landmarkPosition(l);
          return (
            lx >= b.minX - 1 &&
            lx <= b.maxX + 1 &&
            lz >= b.minZ - 1 &&
            lz <= b.maxZ + 1
          );
        });
        if (landmark) this.landmark(k, landmark, b);
        else if (zone === "nawf" && Math.abs(cz - trainZ) < bd / 2 + 1)
          this.fillBlock(k, zone, b, trainZ);
        else this.fillBlock(k, zone, b, Number.NaN);
      }
    if (zone === "nawf") this.buildElevatedTrain(k, d, trainZ);
    this.roofs[zone] = k.roofs;
    this.addKit(k);
  }
  private waterfront(k: Kit, zone: ZoneId, b: BlockInfo) {
    // Promenade, docks and cranes where blocks meet the river.
    const cx = (b.minX + b.maxX) / 2,
      cz = (b.minZ + b.maxZ) / 2;
    const r = k.r;
    if (zone === "downtown" || zone === "rio") {
      for (let i = 0; i < 4; i++) {
        const x = b.minX + r() * (b.maxX - b.minX),
          z = b.minZ + r() * (b.maxZ - b.minZ);
        if (this.nearRiver(x, z, 1.5)) continue;
        if (zone === "downtown" && r() < 0.55) {
          // Container stacks and a crane at the docks.
          for (let s = 0; s < 3; s++)
            box(k, {
              x: x + s * 1.3,
              z,
              w: 1.2,
              d: 2.8,
              h: 0.9 + Math.floor(r() * 3) * 0.9,
              y: 0,
              color: col(pick(r, ["#a6452f", "#2f5f7f", "#c08b32", "#5c6f4a"])),
              windows: false,
              noRoofRecord: true,
            });
          if (r() < 0.6) {
            box(k, {
              x,
              z: z + 3,
              w: 0.5,
              d: 0.5,
              h: 9,
              y: 0,
              color: col("#c4772e"),
              windows: false,
              noRoofRecord: true,
            });
            box(k, {
              x: x + 2.5,
              z: z + 3,
              w: 7,
              d: 0.5,
              h: 0.5,
              y: 9,
              color: col("#c4772e"),
              windows: false,
              noRoofRecord: true,
            });
          }
        } else palm(k, x, z);
      }
    } else if (!this.nearRiver(cx, cz, 2))
      tree(k, cx, cz, 1.2, zone === "south");
  }
  private fillBlock(k: Kit, zone: ZoneId, b: BlockInfo, avoidZ: number) {
    const r = k.r,
      style = DISTRICT_STYLE[zone];
    const W = b.maxX - b.minX,
      D = b.maxZ - b.minZ;
    const blocked = (z: number, depth: number) =>
      !Number.isNaN(avoidZ) && Math.abs(z - avoidZ) < depth / 2 + 1.6;
    if (zone === "downtown") {
      // Towers on a 2×2 grid with podiums and setbacks.
      for (const fx of [0.25, 0.75])
        for (const fz of [0.25, 0.75]) {
          if (r() < 0.12) continue;
          const x = b.minX + W * fx,
            z = b.minZ + D * fz;
          if (this.nearRiver(x, z, 3)) continue;
          const wall = col(pick(r, style.walls));
          const floors = 6 + Math.floor(Math.pow(r(), 1.6) * 30);
          const w = W * 0.42,
            d = D * 0.42;
          const podium = box(k, {
            x,
            z,
            w,
            d,
            h: FLOOR * Math.min(4, floors),
            color: wall,
          });
          if (floors > 4) {
            const top = box(k, {
              x,
              z,
              w: w * 0.78,
              d: d * 0.78,
              h: FLOOR * (floors - 4),
              y: podium,
              color: wall.clone().multiplyScalar(0.92),
            });
            if (floors > 22 && r() < 0.6)
              box(k, {
                x,
                z,
                w: w * 0.4,
                d: d * 0.4,
                h: 1.6,
                y: top,
                color: wall.clone().multiplyScalar(0.8),
                windows: false,
              });
            if (floors > 26)
              k.glow.geometry(
                BLOB,
                placed(x, top + 0.3, z, 0.18, 0.18, 0.18),
                col("#ff4a4a"),
              );
          }
        }
      if (r() < style.trees) tree(k, b.minX + 1, b.minZ + 1, 0.9);
      return;
    }
    // Perimeter rows for neighborhood blocks.
    const lotDepth = zone === "nawf" ? 4.2 : zone === "south" ? 4 : 3.6;
    const lotWidth = zone === "resevoir" ? 3.1 : zone === "rio" ? 3.3 : 3.4;
    const rows: { x: number; z: number; rot: number; w: number }[] = [];
    const along = (len: number) => Math.max(1, Math.floor(len / lotWidth));
    const nxLots = along(W),
      lw = W / nxLots;
    for (let i = 0; i < nxLots; i++) {
      const x = b.minX + lw * (i + 0.5);
      rows.push({ x, z: b.minZ + lotDepth / 2 + 0.3, rot: 0, w: lw });
      rows.push({ x, z: b.maxZ - lotDepth / 2 - 0.3, rot: Math.PI, w: lw });
    }
    const sideLen = D - lotDepth * 2 - 0.6;
    if (sideLen > lotWidth) {
      const nzLots = along(sideLen),
        lz = sideLen / nzLots;
      for (let j = 0; j < nzLots; j++) {
        const z = b.minZ + lotDepth + 0.3 + lz * (j + 0.5);
        rows.push({
          x: b.minX + lotDepth / 2 + 0.3,
          z,
          rot: -Math.PI / 2,
          w: lz,
        });
        rows.push({
          x: b.maxX - lotDepth / 2 - 0.3,
          z,
          rot: Math.PI / 2,
          w: lz,
        });
      }
    }
    // The South gets a mid-rise tower in some blocks; interiors hold trees or lots.
    if (zone === "south" && r() < 0.35) {
      box(k, {
        x: (b.minX + b.maxX) / 2,
        z: (b.minZ + b.maxZ) / 2,
        w: W * 0.32,
        d: D * 0.32,
        h: FLOOR * (10 + Math.floor(r() * 6)),
        color: col(pick(r, style.walls)),
      });
    } else if (r() < style.trees) {
      tree(
        k,
        (b.minX + b.maxX) / 2,
        (b.minZ + b.maxZ) / 2,
        1.1,
        zone === "south",
      );
    }
    for (const lot of rows) {
      if (blocked(lot.z, lotDepth)) continue;
      const w = lot.w - 0.25;
      const wall = col(pick(r, style.walls));
      if (zone === "resevoir") {
        if (r() < 0.3) {
          // Vacant lot: dirt, weeds and a stray tyre.
          box(k, {
            x: lot.x,
            z: lot.z,
            w,
            d: lotDepth,
            h: 0.04,
            rot: lot.rot,
            color: col(r() < 0.5 ? "#5b5a3a" : "#6a5a44"),
            windows: false,
            noRoofRecord: true,
          });
          if (r() < 0.5) tree(k, lot.x, lot.z, 0.6);
          continue;
        }
        const boarded = r() < 0.28;
        const h = FLOOR * (r() < 0.6 ? 2 : 1.5);
        const top = box(k, {
          x: lot.x,
          z: lot.z,
          w: w * 0.86,
          d: lotDepth * 0.8,
          h,
          rot: lot.rot,
          color: boarded ? wall.clone().multiplyScalar(0.65) : wall,
          windows: !boarded,
        });
        gable(
          k,
          lot.x,
          lot.z,
          w * 0.86,
          lotDepth * 0.8,
          top,
          1.1,
          lot.rot + Math.PI / 2,
          col(pick(r, ["#3c3633", "#4a3e3a", "#2f3236"])),
        );
        continue;
      }
      if (zone === "rio") {
        const floors = 1 + Math.floor(r() * 3);
        box(k, {
          x: lot.x,
          z: lot.z,
          w,
          d: lotDepth,
          h: FLOOR * floors + 0.2,
          rot: lot.rot,
          color: wall,
        });
        if (r() < 0.35) {
          // Awning in a warm accent.
          const ox = Math.sin(lot.rot) * (lotDepth / 2 + 0.35),
            oz = Math.cos(lot.rot) * (lotDepth / 2 + 0.35);
          box(k, {
            x: lot.x - ox,
            z: lot.z - oz,
            w: w * 0.8,
            d: 0.7,
            h: 0.12,
            y: CURB + 1.05,
            rot: lot.rot,
            color: col(pick(r, ["#a3322e", "#2f6f5f", "#c48a2c"])),
            windows: false,
            noRoofRecord: true,
          });
        }
        continue;
      }
      // Nawf walk-ups and Southside brick rows.
      const floors =
        zone === "nawf" ? 4 + Math.floor(r() * 3) : 2 + Math.floor(r() * 2);
      const top = box(k, {
        x: lot.x,
        z: lot.z,
        w,
        d: lotDepth,
        h: FLOOR * floors,
        rot: lot.rot,
        color: wall,
      });
      // Cornice line.
      box(k, {
        x: lot.x,
        z: lot.z,
        w: w + 0.1,
        d: lotDepth + 0.1,
        h: 0.18,
        y: top,
        rot: lot.rot,
        color: wall.clone().multiplyScalar(0.7),
        windows: false,
        noRoofRecord: true,
      });
      if (zone === "nawf" && r() < 0.4) {
        // Water tank.
        k.plain.geometry(
          CYL,
          placed(lot.x, top + 0.9, lot.z, 0.45, 1.1, 0.45),
          col("#5a4636"),
        );
        k.plain.geometry(
          CONE,
          placed(lot.x, top + 1.7, lot.z, 0.5, 0.5, 0.5),
          col("#3c2f27"),
        );
      }
    }
  }
  private buildElevatedTrain(k: Kit, d: DistrictRect, z: number) {
    const from = d.minX - 14,
      to = d.maxX + 14,
      deck = 5.2,
      steel = col("#3b3f45");
    box(k, {
      x: (from + to) / 2,
      z,
      w: to - from,
      d: 3.2,
      h: 0.5,
      y: deck,
      color: steel,
      windows: false,
      noRoofRecord: true,
    });
    for (const side of [-1.5, 1.5])
      box(k, {
        x: (from + to) / 2,
        z: z + side,
        w: to - from,
        d: 0.15,
        h: 0.45,
        y: deck + 0.5,
        color: col("#565b62"),
        windows: false,
        noRoofRecord: true,
      });
    for (let x = from + 2; x < to; x += 6)
      for (const side of [-1.3, 1.3])
        box(k, {
          x,
          z: z + side,
          w: 0.4,
          d: 0.4,
          h: deck,
          y: 0,
          color: steel,
          windows: false,
          noRoofRecord: true,
        });
    // Trains are animated, built as one moving group.
    const train = new THREE.Group(),
      tk = this.kit(5);
    for (let c = 0; c < 3; c++) {
      box(tk, {
        x: c * 4.3,
        z: 0,
        w: 4,
        d: 1.9,
        h: 1.5,
        y: 0,
        color: col("#9aa2a8"),
        windows: false,
        noRoofRecord: true,
      });
      tk.glow.quad(
        [c * 4.3 - 1.8, 0.7, 0.96],
        [c * 4.3 + 1.8, 0.7, 0.96],
        [c * 4.3 + 1.8, 1.2, 0.96],
        [c * 4.3 - 1.8, 1.2, 0.96],
        col("#ffd8a0"),
      );
      tk.glow.quad(
        [c * 4.3 + 1.8, 0.7, -0.96],
        [c * 4.3 - 1.8, 0.7, -0.96],
        [c * 4.3 - 1.8, 1.2, -0.96],
        [c * 4.3 + 1.8, 1.2, -0.96],
        col("#ffd8a0"),
      );
    }
    train.add(new THREE.Mesh(tk.plain.build(), this.plainMat));
    train.add(new THREE.Mesh(tk.glow.build(), this.glowMat));
    train.position.set(from, deck + 0.55, z);
    this.scene.add(train);
    let dir = 1;
    this.animated.push((_, dt) => {
      train.position.x += dir * dt * 7;
      if (train.position.x > to - 13) dir = -1;
      if (train.position.x < from) dir = 1;
    });
  }
  private landmark(k: Kit, l: LandmarkDefinition, b: BlockInfo) {
    const [x, z] = landmarkPosition(l),
      r = k.r,
      W = b.maxX - b.minX,
      D = b.maxZ - b.minZ,
      cx = (b.minX + b.maxX) / 2,
      cz = (b.minZ + b.maxZ) / 2;
    const glowWin = (
      gx: number,
      gz: number,
      w: number,
      h: number,
      hex: string,
      face: 1 | -1 = 1,
    ) => {
      const y = CURB + 0.15;
      k.glow.quad(
        [gx - (w / 2) * face, y, gz],
        [gx + (w / 2) * face, y, gz],
        [gx + (w / 2) * face, y + h, gz],
        [gx - (w / 2) * face, y + h, gz],
        col(hex),
      );
    };
    switch (l.id) {
      case "city-hall": {
        const lime = col("#d8cfbd");
        box(k, { x: cx, z: cz, w: W * 0.8, d: D * 0.6, h: 3.6, color: lime });
        for (let i = 0; i < 8; i++)
          k.plain.geometry(
            CYL,
            placed(
              cx - W * 0.33 + (i * W * 0.66) / 7,
              CURB + 1.8,
              cz + D * 0.32,
              0.22,
              3.6,
              0.22,
            ),
            lime,
          );
        box(k, {
          x: cx,
          z: cz,
          w: W * 0.36,
          d: D * 0.36,
          h: 2.4,
          y: CURB + 3.6,
          color: lime,
        });
        k.plain.geometry(
          DOME,
          placed(cx, CURB + 6, cz, 2.3, 2.6, 2.3),
          col("#4f8a7a"),
        );
        k.glow.geometry(
          BLOB,
          placed(cx, CURB + 8.8, cz, 0.18, 0.4, 0.18),
          col("#ffe6b0"),
        );
        break;
      }
      case "central-precinct": {
        const top = box(k, {
          x: cx,
          z: cz,
          w: W * 0.7,
          d: D * 0.6,
          h: FLOOR * 5,
          color: col("#5e6b78"),
        });
        box(k, {
          x: cx,
          z: cz,
          w: W * 0.72,
          d: D * 0.62,
          h: 0.25,
          y: top,
          color: col("#3a434c"),
          windows: false,
          noRoofRecord: true,
        });
        glowWin(cx, cz + D * 0.301, 2.2, 1, "#9cc4ff");
        k.glow.geometry(
          BLOB,
          placed(cx + 1.6, CURB + 1.9, cz + D * 0.32, 0.25, 0.25, 0.25),
          col("#4a7dff"),
        );
        for (let i = 0; i < 3; i++)
          carBody(k, cx - 3 + i * 2.2, cz + D * 0.42, Math.PI / 2, "#e8e8e8");
        break;
      }
      case "courier-depot":
      case "warehouse": {
        const top = box(k, {
          x: cx,
          z: cz,
          w: W * 0.82,
          d: D * 0.62,
          h: 2.7,
          color: col(l.id === "warehouse" ? "#8a8578" : "#9c9a92"),
          windows: false,
        });
        for (let i = 0; i < 4; i++)
          box(k, {
            x: cx - W * 0.3 + i * W * 0.2,
            z: cz,
            w: W * 0.16,
            d: D * 0.6,
            h: 0.7,
            y: top,
            rot: 0,
            color: col("#6f6c66"),
            windows: false,
            noRoofRecord: true,
          });
        for (let i = 0; i < 3; i++)
          box(k, {
            x: cx - W * 0.25 + i * W * 0.25,
            z: cz + D * 0.311,
            w: 1.6,
            d: 0.05,
            h: 1.7,
            color: col("#3d4248"),
            windows: false,
            noRoofRecord: true,
          });
        glowWin(cx + W * 0.36, cz + D * 0.32, 0.6, 0.5, "#ffd18a");
        if (l.id === "courier-depot")
          for (let i = 0; i < 2; i++)
            carBody(k, cx - 2 + i * 2.4, cz + D * 0.43, 0, "#e9e2d0");
        break;
      }
      case "the-towers": {
        const brick = col("#7a4635");
        for (const [fx, fz, rot] of [
          [-0.3, -0.12, 0],
          [0.3, -0.12, 0],
          [0, 0.26, Math.PI / 2],
        ] as const) {
          const tx = cx + W * fx,
            tz = cz + D * fz;
          const top = box(k, {
            x: tx,
            z: tz,
            w: W * 0.26,
            d: D * 0.16,
            h: FLOOR * 20,
            rot,
            color: brick,
          });
          box(k, {
            x: tx,
            z: tz,
            w: W * 0.27,
            d: D * 0.17,
            h: 0.3,
            y: top,
            rot,
            color: col("#4c2f27"),
            windows: false,
            noRoofRecord: true,
          });
          // Balcony stripes.
          for (let f = 2; f < 20; f += 3)
            box(k, {
              x: tx,
              z: tz,
              w: W * 0.27,
              d: D * 0.18,
              h: 0.08,
              y: CURB + f * FLOOR,
              rot,
              color: col("#b9aa98"),
              windows: false,
              noRoofRecord: true,
            });
        }
        box(k, {
          x: cx,
          z: cz - D * 0.36,
          w: W * 0.8,
          d: 0.08,
          h: 0.8,
          color: col("#77736c"),
          windows: false,
          noRoofRecord: true,
        });
        tree(k, cx - W * 0.1, cz + D * 0.05, 1, true);
        tree(k, cx + W * 0.12, cz + D * 0.08, 1, true);
        break;
      }
      case "lot-court": {
        box(k, {
          x: cx,
          z: cz,
          w: W * 0.6,
          d: D * 0.45,
          h: 0.05,
          color: col("#4d6b5a"),
          windows: false,
          noRoofRecord: true,
        });
        k.plain.geometry(
          CYL,
          placed(cx, CURB + 1.4, cz - D * 0.2, 0.08, 2.8, 0.08),
          col("#888"),
        );
        box(k, {
          x: cx,
          z: cz - D * 0.18,
          w: 0.9,
          d: 0.08,
          h: 0.6,
          y: CURB + 2.6,
          color: col("#e8e4dc"),
          windows: false,
          noRoofRecord: true,
        });
        for (const s of [-1, 1])
          box(k, {
            x: cx + s * W * 0.33,
            z: cz,
            w: 0.06,
            d: D * 0.5,
            h: 1.3,
            color: col("#9a9a96"),
            windows: false,
            noRoofRecord: true,
          });
        tree(k, b.minX + 1.5, b.maxZ - 1.5, 1.1);
        tree(k, b.maxX - 1.5, b.minZ + 1.5, 1.2);
        break;
      }
      case "lowrider-garage": {
        box(k, {
          x: cx,
          z: cz,
          w: W * 0.66,
          d: D * 0.5,
          h: 2.6,
          color: col("#c98f6a"),
        });
        box(k, {
          x: cx,
          z: cz + D * 0.251,
          w: W * 0.4,
          d: 0.05,
          h: 1.8,
          color: col("#2a2420"),
          windows: false,
          noRoofRecord: true,
        });
        glowWin(cx, cz + D * 0.26, W * 0.3, 0.3, "#ff6a5a");
        for (let i = 0; i < 3; i++)
          carBody(
            k,
            cx - 3 + i * 3,
            cz + D * 0.4,
            0,
            pick(r, ["#7a1f2b", "#2b5e7a", "#c0a03a", "#5a2a6a"]),
            true,
          );
        palm(k, b.minX + 1.2, b.maxZ - 1.2);
        palm(k, b.maxX - 1.2, b.maxZ - 1.2);
        break;
      }
      case "rio-mural": {
        box(k, {
          x: cx,
          z: cz,
          w: W * 0.7,
          d: D * 0.5,
          h: FLOOR * 3,
          color: col("#d9a185"),
        });
        // Mural face (rebuilt with a texture so it reads from the air).
        const mural = new THREE.Mesh(
          new THREE.PlaneGeometry(W * 0.62, FLOOR * 2.6),
          new THREE.MeshStandardMaterial({
            map: muralTexture(),
            roughness: 0.9,
          }),
        );
        mural.position.set(cx, CURB + FLOOR * 1.5, cz + D * 0.251);
        this.scene.add(mural);
        palm(k, b.minX + 1.4, b.minZ + 1.4);
        break;
      }
      case "memorial": {
        box(k, {
          x: cx,
          z: cz,
          w: W * 0.7,
          d: D * 0.55,
          h: FLOOR * 5,
          color: col("#8a4a36"),
        });
        const wall = new THREE.Mesh(
          new THREE.PlaneGeometry(W * 0.5, FLOOR * 3),
          new THREE.MeshStandardMaterial({
            map: muralTexture(),
            color: "#c8b8b0",
            roughness: 0.9,
          }),
        );
        wall.position.set(cx, CURB + FLOOR * 1.7, cz + D * 0.276);
        this.scene.add(wall);
        // Purple tag across the memorial: the Blips' defacement.
        box(k, {
          x: cx,
          z: cz + D * 0.28,
          w: W * 0.45,
          d: 0.04,
          h: 0.25,
          y: CURB + FLOOR * 1.8,
          rot: 0.25,
          color: col("#8e51cb"),
          windows: false,
          noRoofRecord: true,
        });
        for (let i = 0; i < 9; i++)
          k.glow.geometry(
            BLOB,
            placed(
              cx - W * 0.2 + r() * W * 0.4,
              CURB + 0.12,
              cz + D * 0.31 + r() * 0.5,
              0.07,
              0.12,
              0.07,
            ),
            col("#ffb35a"),
          );
        for (let i = 0; i < 6; i++)
          k.plain.geometry(
            BLOB,
            placed(
              cx - W * 0.2 + r() * W * 0.4,
              CURB + 0.15,
              cz + D * 0.33 + r() * 0.4,
              0.16,
              0.12,
              0.16,
            ),
            col(pick(r, ["#e8e2d8", "#c23a4a", "#e8b84a"])),
          );
        break;
      }
      case "el-station": {
        box(k, {
          x: cx,
          z: this.trainZ,
          w: W * 0.5,
          d: 4.2,
          h: 2.2,
          y: 5.2,
          color: col("#6c5a48"),
          windows: true,
          noRoofRecord: true,
        });
        box(k, {
          x: cx + W * 0.2,
          z: cz + D * 0.2,
          w: 1.2,
          d: 1.2,
          h: 5.2,
          color: col("#4a4f55"),
          windows: false,
          noRoofRecord: true,
        });
        glowWin(cx, this.trainZ + 2.11, W * 0.4, 0.6, "#ffe0a0");
        break;
      }
      default: {
        // Storefront landmarks: retail, bodega, repair, laundry, corner.
        const palette: Record<string, [string, string, string]> = {
          "nawf-bodega": ["#8a4a36", "#e3c23a", "#ffe9a0"],
          "repair-counter": ["#7c4434", "#3f6a8a", "#a8d4ff"],
          laundry: ["#a69683", "#3a9a8a", "#a8fff0"],
          "back-street-corner": ["#6a3c32", "#c83d45", "#ffb0a0"],
          "rio-mercado": ["#e3b98f", "#2f6f5f", "#ffe0b0"],
          "south-retail": ["#8c5442", "#9a7a3a", "#ffe0b0"],
          "resevoir-retail": ["#9e8a7c", "#5a6a8a", "#ffe0b0"],
          "downtown-retail": ["#c9c2b4", "#2f4f6f", "#e0f0ff"],
        };
        const [wall, awning, light] = palette[l.id] ?? [
          "#a08070",
          "#7a3a3a",
          "#ffe0b0",
        ];
        const floors = l.zone === "downtown" ? 7 : l.zone === "nawf" ? 5 : 2;
        box(k, {
          x: cx,
          z: cz,
          w: W * 0.66,
          d: D * 0.5,
          h: FLOOR * floors,
          color: col(wall),
        });
        box(k, {
          x: cx,
          z: cz + D * 0.29,
          w: W * 0.6,
          d: 0.9,
          h: 0.14,
          y: CURB + 1.1,
          color: col(awning),
          windows: false,
          noRoofRecord: true,
        });
        glowWin(cx, cz + D * 0.251, W * 0.5, 0.9, light);
        // Sign board.
        box(k, {
          x: cx,
          z: cz + D * 0.255,
          w: W * 0.4,
          d: 0.06,
          h: 0.35,
          y: CURB + 1.35,
          color: col(awning).multiplyScalar(1.3),
          windows: false,
          noRoofRecord: true,
        });
        if (l.zone === "rio") palm(k, b.maxX - 1.2, b.maxZ - 1.2);
        else tree(k, b.minX + 1.2, b.maxZ - 1.2, 0.9, l.zone === "south");
      }
    }
    void x;
    void z;
  }
  private buildFiller() {
    // The rest of the city fades into fog: darker, plainer blocks that make the
    // five districts read as the living part of the board.
    const k = this.kit(4242),
      step = 12,
      wall = ["#3e3b3c", "#46423f", "#3a3d43", "#4a4540", "#353538"];
    for (let x = -246; x <= 246; x += step)
      for (let z = -246; z <= 246; z += step) {
        const cx = x + (k.r() - 0.5) * 2,
          cz = z + (k.r() - 0.5) * 2;
        const inside = ZONE_ORDER.some((id) => {
          const d = DISTRICTS[id];
          return (
            cx > d.minX - 7 &&
            cx < d.maxX + 7 &&
            cz > d.minZ - 7 &&
            cz < d.maxZ + 7
          );
        });
        if (inside || this.nearRiver(cx, cz, 6)) continue;
        if (
          AVENUES_X.some((a) => Math.abs(cx - a) < 7) ||
          AVENUES_Z.some((a) => Math.abs(cz - a) < 7)
        )
          continue;
        const far = Math.max(Math.abs(cx), Math.abs(cz)) > 130;
        const floors = far
          ? 3 + Math.floor(k.r() * 14)
          : 2 + Math.floor(Math.pow(k.r(), 2) * 8);
        box(k, {
          x: cx,
          z: cz,
          w: step - 3.5,
          d: step - 3.5,
          h: CURB,
          y: 0,
          color: col("#4f4e4b"),
          windows: false,
          noRoofRecord: true,
        });
        box(k, {
          x: cx,
          z: cz,
          w: step - 5 - k.r() * 2,
          d: step - 5 - k.r() * 2,
          h: FLOOR * floors,
          color: col(pick(k.r, wall)),
          noRoofRecord: true,
        });
      }
    this.addKit(k);
  }
  private buildStreetFurniture() {
    // Street lamps and their light pools along every district edge.
    const lamps: [number, number][] = [];
    for (const zone of ZONE_ORDER) {
      const d = DISTRICTS[zone];
      for (let x = d.minX; x <= d.maxX; x += 8)
        lamps.push([x, d.minZ - 0.4], [x, d.maxZ + 0.4]);
      for (let z = d.minZ + 8; z < d.maxZ; z += 8)
        lamps.push([d.minX - 0.4, z], [d.maxX + 0.4, z]);
    }
    const usable = lamps.filter(([x, z]) => !this.nearRiver(x, z, 1));
    const poles = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.07, 0.09, 3.2, 5).translate(0, 1.6, 0),
      this.plainMat,
      usable.length,
    );
    const heads = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.3),
      this.lampHeadMat,
      usable.length,
    );
    const pools = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      this.lampPoolMat,
      usable.length,
    );
    const grey = col("#2c2d30");
    usable.forEach(([x, z], i) => {
      poles.setMatrixAt(i, placed(x, 0, z));
      poles.setColorAt(i, grey);
      heads.setMatrixAt(i, placed(x, 3.2, z));
      pools.setMatrixAt(i, placed(x, 0.08, z, 6.5, 1, 6.5));
    });
    pools.renderOrder = 2;
    this.scene.add(poles, heads, pools);
    // Lane dashes on the avenues.
    const dashes: [number, number, number][] = [];
    for (const ax of AVENUES_X)
      for (let z = BOARD.minZ; z < BOARD.maxZ; z += 4)
        dashes.push([ax, z, Math.PI / 2]);
    for (const az of AVENUES_Z)
      for (let x = BOARD.minX; x < BOARD.maxX; x += 4) dashes.push([x, az, 0]);
    const kept = dashes.filter(([x, z]) => !this.nearRiver(x, z, 0.5));
    const dashMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.4, 0.16).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: "#c9a446", roughness: 0.6 }),
      kept.length,
    );
    kept.forEach(([x, z, r], i) =>
      dashMesh.setMatrixAt(i, placed(x, 0.03, z, 1, 1, 1, r)),
    );
    this.scene.add(dashMesh);
  }
  private carGeometry(low = false) {
    const k = this.kit(1);
    box(k, {
      x: 0,
      z: 0,
      w: 1.5,
      d: 0.72,
      h: low ? 0.28 : 0.38,
      y: 0.1,
      color: col("#ffffff"),
      windows: false,
      noRoofRecord: true,
    });
    box(k, {
      x: -0.1,
      z: 0,
      w: 0.78,
      d: 0.62,
      h: 0.26,
      y: low ? 0.38 : 0.48,
      color: col("#2a2f36"),
      windows: false,
      noRoofRecord: true,
    });
    return k.plain.build();
  }
  private buildTraffic() {
    // Civilian traffic loops the avenues around every district.
    const movers: Mover[] = [];
    const r = rng(77);
    for (const zone of ZONE_ORDER) {
      const d = DISTRICTS[zone];
      const base = loop(
        rectLoop(d.minX - 1.9, d.minZ - 1.9, d.maxX + 1.9, d.maxZ + 1.9),
      );
      for (let i = 0; i < 5; i++)
        movers.push({ ...base, t: r() * base.total, speed: 4 + r() * 3, y: 0 });
    }
    const cars = new THREE.InstancedMesh(
      this.carGeometry(),
      this.plainMat,
      movers.length,
    );
    const colors = [
      "#7a1f2b",
      "#d8d4cc",
      "#20242a",
      "#2b5e7a",
      "#8a8f94",
      "#5a4a3a",
      "#c0a03a",
    ];
    movers.forEach((_, i) => cars.setColorAt(i, col(pick(r, colors))));
    this.scene.add(cars);
    const tmp = { x: 0, z: 0, heading: 0 };
    this.animated.push((_, dt) => {
      movers.forEach((m, i) => {
        m.t += m.speed * dt;
        sample(m, tmp);
        cars.setMatrixAt(i, placed(tmp.x, 0, tmp.z, 1, 1, 1, tmp.heading));
      });
      cars.instanceMatrix.needsUpdate = true;
    });
  }

  // ---- state-driven layer ------------------------------------------------------------
  private rebuildDynamic() {
    for (const child of [...this.dynamic.children]) {
      this.dynamic.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat && !Array.isArray(mat) && !this.isShared(mat)) mat.dispose();
      });
    }
    this.dynamicAnimated = [];
    const view = this.view;
    if (!view) return;
    for (const id of ZONE_ORDER) this.territory(view.zones[id]);
    this.police(view);
    this.pedestrians(view);
    this.beacons(view);
  }
  private isShared(m: THREE.Material) {
    return [
      this.facadeMat,
      this.plainMat,
      this.glowMat,
      this.lampPoolMat,
      this.lampHeadMat,
    ].includes(m as never);
  }
  private territory(z: ZoneView) {
    const d = DISTRICTS[z.id],
      selected = this.selected === z.id,
      dim = this.selected && !selected;
    const W = d.maxX - d.minX,
      D = d.maxZ - d.minZ;
    // Faction-colored streets: strips sized by each faction's share of presence.
    const strips = z.presence.length
      ? z.presence
      : [{ color: z.controllerColor, share: 1, presence: 20 }];
    let x = d.minX;
    const overlays: THREE.MeshBasicMaterial[] = [];
    for (const s of strips) {
      const w = W * s.share;
      const mat = new THREE.MeshBasicMaterial({
        color: s.color,
        transparent: true,
        opacity:
          (z.presence.length ? 0.12 + (s.presence / 100) * 0.22 : 0.06) *
          (dim ? 0.55 : 1),
        depthWrite: false,
        toneMapped: false,
      });
      overlays.push(mat);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(w, D).rotateX(-Math.PI / 2),
        mat,
      );
      plane.position.set(x + w / 2, 0.035, d.minZ + D / 2);
      plane.renderOrder = 1;
      this.dynamic.add(plane);
      x += w;
    }
    // District border.
    const borderColor = selected ? "#fff3d6" : z.controllerColor;
    const borderMat = new THREE.MeshBasicMaterial({
      color: borderColor,
      transparent: true,
      opacity: selected ? 0.95 : dim ? 0.35 : 0.7,
      toneMapped: false,
    });
    const thick = selected ? 0.75 : 0.45;
    const edges: [number, number, number, number][] = [
      [d.minX + W / 2, d.minZ, W, thick],
      [d.minX + W / 2, d.maxZ, W, thick],
      [d.minX, d.minZ + D / 2, thick, D],
      [d.maxX, d.minZ + D / 2, thick, D],
    ];
    for (const [ex, ez, ew, ed] of edges) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ew, 0.12, ed), borderMat);
      m.position.set(ex, 0.07, ez);
      this.dynamic.add(m);
    }
    if (z.contested)
      this.dynamicAnimated.push((t) => {
        borderMat.color.set(Math.sin(t * 4) > 0 ? "#ff8a5a" : borderColor);
        for (const o of overlays)
          o.opacity = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(t * 3));
      });
    // Faction flags on rooftops, count follows presence.
    const roofs = this.roofs[z.id];
    if (roofs.length) {
      const r = rng(z.id.length * 31 + 7);
      const flagGeo = new THREE.PlaneGeometry(1.1, 0.65).translate(0.55, 0, 0);
      for (const s of z.presence) {
        const n = Math.min(10, Math.round(s.presence / 9));
        if (!n) continue;
        const poles = new THREE.InstancedMesh(
          new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4).translate(0, 0.8, 0),
          this.plainMat,
          n,
        );
        const flags = new THREE.InstancedMesh(
          flagGeo.clone(),
          new THREE.MeshStandardMaterial({
            color: s.color,
            side: THREE.DoubleSide,
            emissive: s.color,
            emissiveIntensity: 0.35,
            roughness: 0.7,
          }),
          n,
        );
        const spots: V3[] = [];
        for (let i = 0; i < n; i++)
          spots.push(roofs[Math.floor(r() * roofs.length)]);
        spots.forEach(([fx, fy, fz], i) => {
          poles.setMatrixAt(i, placed(fx, fy, fz));
          poles.setColorAt(i, col("#2a2a2a"));
          flags.setMatrixAt(i, placed(fx, fy + 1.25, fz, 1, 1, 1, r() * 6));
        });
        this.dynamic.add(poles, flags);
        const phases = spots.map(() => r() * 6);
        this.dynamicAnimated.push((t) => {
          spots.forEach(([fx, fy, fz], i) => {
            flags.setMatrixAt(
              i,
              placed(
                fx,
                fy + 1.25,
                fz,
                1,
                1,
                1,
                phases[i] + Math.sin(t * 2 + phases[i]) * 0.35,
              ),
            );
          });
          flags.instanceMatrix.needsUpdate = true;
        });
      }
    }
    // Recent consequences ripple outward from the district centre.
    if (z.recent.length) {
      const tension = z.recent.some((e) => e.tone === "tension");
      const ringMat = new THREE.MeshBasicMaterial({
        color: tension ? "#ff6a4a" : "#7fe0a0",
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2),
        ringMat,
      );
      const [cx, cz] = districtCenter(z.id);
      ring.position.set(cx, 0.5, cz);
      this.dynamic.add(ring);
      const max = Math.min(W, D) * 0.55;
      this.dynamicAnimated.push((t) => {
        const f = (t * 0.35) % 1;
        ring.scale.setScalar(4 + f * max);
        ringMat.opacity = (1 - f) * 0.7;
      });
    }
  }
  private police(view: CityView) {
    const units: { mover: Mover; zone: ZoneId }[] = [];
    const r = rng(view.day * 13 + 5);
    for (const id of ZONE_ORDER) {
      const z = view.zones[id],
        d = DISTRICTS[id],
        s = this.innerStreets[id];
      const n = Math.max(0, Math.round(z.police / 22));
      const xs = s.xs.length ? s.xs : [(d.minX + d.maxX) / 2];
      const zs = s.zs.length ? s.zs : [(d.minZ + d.maxZ) / 2];
      const routes = [
        loop(
          rectLoop(
            xs[0],
            zs[0],
            xs[xs.length - 1] + (xs.length === 1 ? 6 : 0),
            zs[zs.length - 1] + (zs.length === 1 ? 6 : 0),
          ),
        ),
        loop(rectLoop(d.minX - 1.9, d.minZ - 1.9, d.maxX + 1.9, d.maxZ + 1.9)),
      ];
      for (let i = 0; i < n; i++) {
        const route = routes[i % routes.length];
        units.push({
          zone: id,
          mover: { ...route, t: r() * route.total, speed: 5 + r() * 2, y: 0 },
        });
      }
    }
    if (!units.length) return;
    const cars = new THREE.InstancedMesh(
      this.carGeometry(),
      this.plainMat,
      units.length,
    );
    units.forEach((_, i) =>
      cars.setColorAt(i, col(i % 2 ? "#e9e9e9" : "#1d2026")),
    );
    const red = new THREE.MeshBasicMaterial({
      color: "#ff2a2a",
      toneMapped: false,
    });
    const blue = new THREE.MeshBasicMaterial({
      color: "#2a5cff",
      toneMapped: false,
    });
    const barGeo = new THREE.BoxGeometry(0.16, 0.12, 0.26);
    const reds = new THREE.InstancedMesh(barGeo, red, units.length);
    const blues = new THREE.InstancedMesh(barGeo.clone(), blue, units.length);
    const glowMat = new THREE.MeshBasicMaterial({
      map: this.glowTex,
      color: "#ff3a3a",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const glows = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      glowMat,
      units.length,
    );
    this.dynamic.add(cars, reds, blues, glows);
    const tmp = { x: 0, z: 0, heading: 0 };
    const night = () =>
      this.time === "day" ? 0.25 : this.time === "dusk" ? 0.7 : 1;
    this.dynamicAnimated.push((t, dt) => {
      const on = Math.floor(t * 5) % 2 === 0;
      red.color.setRGB(on ? 1 : 0.18, 0.05, 0.05);
      blue.color.setRGB(0.05, 0.12, on ? 0.18 : 1);
      glowMat.color.set(on ? "#ff3030" : "#3060ff");
      glowMat.opacity = 0.6 * night();
      units.forEach((u, i) => {
        u.mover.t += u.mover.speed * dt;
        sample(u.mover, tmp);
        cars.setMatrixAt(i, placed(tmp.x, 0, tmp.z, 1, 1, 1, tmp.heading));
        const s = Math.sin(tmp.heading),
          c = Math.cos(tmp.heading);
        reds.setMatrixAt(
          i,
          placed(
            tmp.x - 0.1 * c + 0.14 * s,
            0.82,
            tmp.z + 0.1 * s + 0.14 * c,
            1,
            1,
            1,
            tmp.heading,
          ),
        );
        blues.setMatrixAt(
          i,
          placed(
            tmp.x - 0.1 * c - 0.14 * s,
            0.82,
            tmp.z + 0.1 * s - 0.14 * c,
            1,
            1,
            1,
            tmp.heading,
          ),
        );
        glows.setMatrixAt(i, placed(tmp.x, 0.09, tmp.z, 4.5, 1, 4.5));
      });
      for (const m of [cars, reds, blues, glows])
        m.instanceMatrix.needsUpdate = true;
    });
  }
  private pedestrians(view: CityView) {
    // Street life follows civilian climate; corner crowds follow the street economy.
    const walkers: {
      block: BlockInfo;
      t: number;
      speed: number;
      mover: Mover;
    }[] = [];
    const r = rng(view.day * 7 + 3);
    for (const id of ZONE_ORDER) {
      const z = view.zones[id];
      const blocks = this.blocks.filter((b) => b.zone === id);
      const n = Math.round(
        8 + (z.support / 100) * 22 + (z.commerce / 100) * 10,
      );
      for (let i = 0; i < n && blocks.length; i++) {
        const b = blocks[Math.floor(r() * blocks.length)];
        const route = loop(
          rectLoop(b.minX + 0.3, b.minZ + 0.3, b.maxX - 0.3, b.maxZ - 0.3),
        );
        walkers.push({
          block: b,
          t: 0,
          speed: 0,
          mover: {
            ...route,
            t: r() * route.total,
            speed: (0.5 + r() * 0.6) * (r() < 0.5 ? 1 : -1),
            y: CURB,
          },
        });
      }
    }
    const crowd: [number, number, string][] = [];
    for (const l of LANDMARKS.filter(
      (l) => l.kind === "street" || l.kind === "transit",
    )) {
      const z = view.zones[l.zone];
      const n = Math.round((z.streetActivity / 100) * 7);
      const [lx, lz] = landmarkPosition(l);
      const tint = z.presence[0]?.color ?? z.controllerColor;
      for (let i = 0; i < n; i++)
        crowd.push([
          lx + (r() - 0.5) * 3.2,
          lz + 3.4 + (r() - 0.5) * 1.2,
          tint,
        ]);
    }
    const total = walkers.length + crowd.length;
    if (!total) return;
    const geo = new THREE.CapsuleGeometry(0.17, 0.42, 2, 5).translate(
      0,
      0.38,
      0,
    );
    const people = new THREE.InstancedMesh(geo, this.plainMat, total);
    const clothes = [
      "#2b2f36",
      "#7a2f2f",
      "#d8d2c4",
      "#3a5a7a",
      "#a87a3a",
      "#4a3a5a",
      "#1f1f1f",
      "#c9a04a",
    ];
    for (let i = 0; i < total; i++)
      people.setColorAt(
        i,
        col(
          i >= walkers.length ? crowd[i - walkers.length][2] : pick(r, clothes),
        ),
      );
    crowd.forEach(([x, z], i) =>
      people.setMatrixAt(walkers.length + i, placed(x, CURB, z)),
    );
    this.dynamic.add(people);
    const tmp = { x: 0, z: 0, heading: 0 };
    this.dynamicAnimated.push((_, dt) => {
      walkers.forEach((w, i) => {
        w.mover.t += w.mover.speed * dt;
        sample(w.mover, tmp);
        people.setMatrixAt(i, placed(tmp.x, CURB, tmp.z));
      });
      people.instanceMatrix.needsUpdate = true;
    });
  }
  private beacons(view: CityView) {
    // Your footprint: owned businesses, your job and your home district.
    const items: { x: number; z: number; color: string; h: number }[] = [];
    for (const l of LANDMARKS) {
      const st = view.landmarks[l.id];
      const [x, z] = landmarkPosition(l);
      if (st?.owned) items.push({ x, z, color: view.playerAccent, h: 26 });
      else if (st?.employed) items.push({ x, z, color: "#f5e6c8", h: 16 });
      if (l.id === this.selectedLandmark) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: "#fff3d6",
          transparent: true,
          toneMapped: false,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(4.4, 4.9, 40).rotateX(-Math.PI / 2),
          ringMat,
        );
        ring.position.set(x, 0.32, z);
        this.dynamic.add(ring);
        this.dynamicAnimated.push((t) => {
          ringMat.opacity = 0.55 + 0.4 * Math.sin(t * 4);
        });
      }
    }
    for (const id of ZONE_ORDER)
      if (view.zones[id].isHome) {
        const [x, z] = districtCenter(id);
        const d = DISTRICTS[id];
        items.push({
          x: d.minX + 2,
          z: d.minZ + 2,
          color: view.playerAccent,
          h: 10,
        });
        void x;
        void z;
      }
    for (const b of items) {
      const mat = new THREE.MeshBasicMaterial({
        color: b.color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, b.h, 10, 1, true).translate(
          0,
          b.h / 2,
          0,
        ),
        mat,
      );
      beam.position.set(b.x, 0, b.z);
      this.dynamic.add(beam);
      this.dynamicAnimated.push((t) => {
        mat.opacity = 0.25 + 0.12 * Math.sin(t * 2 + b.x);
      });
    }
  }

  // ---- camera & input ----------------------------------------------------------------
  private flyTo(x: number, z: number, d: number, yaw = this.yaw) {
    this.flight = {
      from: {
        x: this.target.x,
        z: this.target.z,
        d: this.distance,
        yaw: this.yaw,
      },
      to: { x, z, d, yaw },
      t: 0,
    };
    this.wake();
  }
  private pitch() {
    // Closer views tilt toward the street; the overview reads like a board.
    const f = THREE.MathUtils.clamp((this.distance - 40) / 180, 0, 1);
    return THREE.MathUtils.lerp(0.46, 0.68, f);
  }
  private updateCamera() {
    const p = this.pitch();
    const off = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(p),
      Math.sin(p),
      Math.cos(this.yaw) * Math.cos(p),
    ).multiplyScalar(this.distance);
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
    this.sky.position.copy(this.camera.position);
  }
  private groundAt(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit)
      ? hit
      : null;
  }
  private bindInput(el: HTMLCanvasElement) {
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.flight = null;
      this.onInteract();
      if (this.pointers.size === 1) {
        this.gesture = {
          startX: e.clientX,
          startY: e.clientY,
          moved: 0,
          start: performance.now(),
          groundStart: this.groundAt(e.clientX, e.clientY) ?? undefined,
          targetStart: this.target.clone(),
        };
      } else if (this.pointers.size === 2 && this.gesture) {
        const [a, b] = [...this.pointers.values()];
        this.gesture.pinch = {
          dist: Math.hypot(b.x - a.x, b.y - a.y),
          angle: Math.atan2(b.y - a.y, b.x - a.x),
          distance: this.distance,
          yaw: this.yaw,
        };
        this.gesture.moved = 99;
      }
      this.wake();
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.pointers.has(e.pointerId) || !this.gesture) return;
      const prev = this.pointers.get(e.pointerId)!;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = this.gesture;
      g.moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      if (this.pointers.size >= 2 && g.pinch) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(b.x - a.x, b.y - a.y),
          angle = Math.atan2(b.y - a.y, b.x - a.x);
        this.distance = THREE.MathUtils.clamp(
          (g.pinch.distance * g.pinch.dist) / Math.max(dist, 1),
          26,
          260,
        );
        this.yaw = g.pinch.yaw - (angle - g.pinch.angle);
      } else if (e.buttons === 2 || e.shiftKey) {
        this.yaw -= (e.clientX - prev.x) * 0.008;
      } else if (g.groundStart && g.targetStart) {
        // Drag the board under the finger.
        this.updateCamera();
        const now = this.groundAt(e.clientX, e.clientY);
        if (now) {
          const delta = g.groundStart.clone().sub(now);
          this.target.x = THREE.MathUtils.clamp(
            this.target.x + delta.x,
            BOARD.minX,
            BOARD.maxX,
          );
          this.target.z = THREE.MathUtils.clamp(
            this.target.z + delta.z,
            BOARD.minZ,
            BOARD.maxZ,
          );
        }
      }
      this.wake();
    });
    const end = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      const g = this.gesture;
      if (g && this.pointers.size === 0) {
        if (g.moved < 10 && performance.now() - g.start < 500)
          this.pickAt(e.clientX, e.clientY);
        this.gesture = null;
      } else if (g && this.pointers.size === 1) {
        // Continue panning with the remaining finger.
        const [p] = [...this.pointers.values()];
        g.pinch = undefined;
        g.groundStart = this.groundAt(p.x, p.y) ?? undefined;
        g.targetStart = this.target.clone();
      }
      this.wake();
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.flight = null;
        this.distance = THREE.MathUtils.clamp(
          this.distance * Math.exp(e.deltaY * 0.0012),
          26,
          260,
        );
        this.wake();
      },
      { passive: false },
    );
  }
  private pickAt(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    // Landmarks are only tappable once you're close enough to see them.
    if (this.distance < 150) {
      const hit = this.raycaster.intersectObjects(this.pickers, false)[0];
      if (hit) {
        const id = hit.object.userData.landmark as string;
        const l = LANDMARKS.find((l) => l.id === id)!;
        this.onPick({ zone: l.zone, landmark: id });
        return;
      }
    }
    const zone = this.raycaster.intersectObjects(
      this.districtPickers,
      false,
    )[0];
    this.onPick({
      zone: (zone?.object.userData.zone as ZoneId) ?? null,
      landmark: null,
    });
  }

  // ---- loop -----------------------------------------------------------------------
  private onVisibility = () => {
    if (!document.hidden) this.start();
  };
  private wake() {
    this.lastActive = performance.now();
    this.start();
  }
  private start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }
  private tick = (now: number) => {
    if (this.disposed) return;
    if (document.hidden || !this.visible) {
      this.running = false;
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
    const active =
      now - this.lastActive < 1200 || this.pointers.size > 0 || !!this.flight;
    if (!active && (this.lite || this.reducedMotion)) {
      // Still city: stop until the next touch, state change or flight.
      this.running = false;
      cancelAnimationFrame(this.frame);
      return;
    }
    // Ambient life renders at ~30fps; gestures and flights get every frame.
    if (!active && now - this.lastFrame < 32) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.clock += dt;
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / 0.9);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      this.target.x = THREE.MathUtils.lerp(f.from.x, f.to.x, e);
      this.target.z = THREE.MathUtils.lerp(f.from.z, f.to.z, e);
      this.distance = THREE.MathUtils.lerp(f.from.d, f.to.d, e);
      this.yaw = THREE.MathUtils.lerp(f.from.yaw, f.to.yaw, e);
      if (f.t >= 1) this.flight = null;
    }
    for (const a of this.animated) a(this.clock, dt);
    for (const a of this.dynamicAnimated) a(this.clock, dt);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.positionOverlays();
  };
  private positionOverlays() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight,
      v = new THREE.Vector3();
    for (const o of this.overlays) {
      v.copy(o.position).project(this.camera);
      const behind = v.z > 1;
      const far =
        (o.maxDistance !== undefined && this.distance > o.maxDistance) ||
        (o.minDistance !== undefined && this.distance < o.minDistance);
      const x = (v.x * 0.5 + 0.5) * w,
        y = (-v.y * 0.5 + 0.5) * h;
      const off =
        behind || far || x < -40 || x > w + 40 || y < -20 || y > h + 40;
      o.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      o.element.style.opacity = off ? "0" : "1";
      o.element.style.pointerEvents = off ? "none" : "";
      o.element.style.visibility = off ? "hidden" : "visible";
    }
  }
}

function landmarkHeight(l: LandmarkDefinition) {
  if (l.id === "the-towers") return 18.5;
  if (l.id === "city-hall") return 9;
  if (l.id === "el-station") return 7.6;
  if (l.zone === "downtown") return 6.5;
  if (l.zone === "nawf") return 4.8;
  return 3;
}

function isSoftwareRenderer(r: THREE.WebGLRenderer) {
  try {
    const gl = r.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(
      info
        ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    );
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}
