import * as THREE from "three";
import type { FactionId, ZoneId } from "../core/GameState";
import {
  ALL_BLOCKS,
  AVENUES_X,
  AVENUES_Z,
  BOARD,
  DISTRICTS,
  RIVER_WIDTH,
  ZONE_ORDER,
  blockAt,
  blockById,
  districtCenter,
  districtGrid,
  distanceToPath,
  locationBlock,
  locationPosition,
  riverPath,
  type BlockDef,
} from "../city3d/layout";
import { LOCATIONS, type LocationDef } from "./locations";
import {
  buildLocation,
  DISTRICT_STYLE,
  fillBlock,
  waterfront,
  type Rect,
} from "./archetypes";
import {
  Geo,
  box,
  col,
  hash,
  kit,
  onWall,
  pick,
  placed,
  rng,
  CURB,
  type Kit,
  type V3,
  type WallSlot,
} from "./geo";
import { facadeTextures, radialTexture, SignAtlas } from "./textures";
import type { BoardView } from "./viewModel";
import { buildFigure, loadFigureModel } from "./character";
import { DEFAULT_APPEARANCE, type Appearance } from "./presence";

export type TimeOfDay = "dusk" | "night" | "day";
export type Lens = "streets" | "influence" | "police" | "opportunity";
export interface Focus {
  zone: ZoneId | null;
  block: string | null;
  place: string | null;
}
export interface PickResult extends Focus {}
export interface OverlayAnchor {
  key: string;
  element: HTMLElement;
  position: THREE.Vector3;
  maxDistance?: number;
  minDistance?: number;
  /** Pixels the element extends above its anchor (kept clear of the HUD). */
  clearance?: number;
}
type Lit = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;

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
    signs: number;
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
    signs: 0.35,
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
    signs: 0.75,
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
    signs: 0,
    lamps: 0,
    exposure: 1,
  },
};

const TAGS: Record<
  FactionId,
  { text: string; color: string; crown: boolean; cloth: [string, string] }
> = {
  backstreet: {
    text: "BS",
    color: "#e0303a",
    crown: true,
    cloth: ["#c83d45", "#f0e6d8"],
  },
  blocks: {
    text: "BB",
    color: "#3f86e0",
    crown: true,
    cloth: ["#3678c6", "#e8eefc"],
  },
  angels: {
    text: "GA",
    color: "#f0c43a",
    crown: true,
    cloth: ["#e9be39", "#f5f1e6"],
  },
  blips: {
    text: "BLIP GANG",
    color: "#a35ee8",
    crown: false,
    cloth: ["#8e51cb", "#d8c8f0"],
  },
  muds: {
    text: "MUDGANG",
    color: "#e8892f",
    crown: false,
    cloth: ["#cd7935", "#80513c"],
  },
};

/** Camera distance for each level of the board. */
export const LEVEL_DISTANCE = {
  city: 205,
  district: 100,
  block: 52,
  place: 40,
};

interface Mover {
  path: [number, number][];
  lengths: number[];
  total: number;
  t: number;
  speed: number;
}
function loop(path: [number, number][]) {
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
  a: number,
  b: number,
  c: number,
  d: number,
): [number, number][] => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];

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
export function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export class BoardRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 1, 900);
  onPick: (r: PickResult) => void = () => {};
  onInteract: () => void = () => {};
  onLevel: (distance: number) => void = () => {};

  private host!: HTMLElement;
  private lite = false;
  private reducedMotion = false;
  private river = riverPath();
  private textures = facadeTextures();
  private glowTex = radialTexture();
  private atlas = new SignAtlas();
  private facadeMat!: Lit;
  private plainMat!: Lit;
  private groundMat!: Lit;
  private waterMat!: Lit;
  private signMat!: Lit;
  private tagMat!: Lit;
  private glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
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
  private sky!: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private placePickers: THREE.Mesh[] = [];
  private walls = new Map<string, WallSlot[]>();
  private roofs = new Map<string, V3[]>();
  private streets: Record<ZoneId, { xs: number[]; zs: number[] }> = {
    downtown: { xs: [], zs: [] },
    nawf: { xs: [], zs: [] },
    south: { xs: [], zs: [] },
    reservoir: { xs: [], zs: [] },
    rio: { xs: [], zs: [] },
  };
  private trainZ = 0;
  private dynamic = new THREE.Group();
  // Player piece and people on the board.
  private token = new THREE.Group();
  private tokenRing!: THREE.MeshBasicMaterial;
  private tokenWalk: {
    path: [number, number][];
    t: number;
    total: number;
    done: () => void;
  } | null = null;
  private figures = new THREE.Group();
  private tokenBody = new THREE.Group();
  private appearanceKey = "";
  private focusLayer = new THREE.Group();
  private animated: ((t: number, dt: number) => void)[] = [];
  private dynamicAnimated: ((t: number, dt: number) => void)[] = [];
  private focusAnimated: ((t: number, dt: number) => void)[] = [];
  private overlays: OverlayAnchor[] = [];
  private view: BoardView | null = null;
  private focus: Focus = { zone: null, block: null, place: null };
  private lens: Lens = "streets";
  private time: TimeOfDay = "dusk";
  private timeApplied = false;

  private target = new THREE.Vector3(0, 0, 12);
  private distance = LEVEL_DISTANCE.city;
  private yaw = 0;
  private insets = { top: 0, bottom: 0 };
  private flight: {
    from: { x: number; z: number; d: number; yaw: number };
    to: { x: number; z: number; d: number; yaw: number };
    t: number;
  } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: {
    moved: number;
    start: number;
    pinch?: { dist: number; angle: number; distance: number; yaw: number };
    groundStart?: THREE.Vector3;
  } | null = null;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private frame = 0;
  private running = false;
  private visible = true;
  private lastFrame = 0;
  private lastActive = 0;
  private clock = 0;
  private observer: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private lastLevelDistance = -1;

  private static instance: BoardRenderer | null = null;
  /** One city per page; leaving the board detaches it instead of destroying it. */
  static acquire(host: HTMLElement) {
    if (!BoardRenderer.instance || BoardRenderer.instance.disposed)
      BoardRenderer.instance = new BoardRenderer(host);
    else BoardRenderer.instance.attach(host);
    return BoardRenderer.instance;
  }

  private constructor(host: HTMLElement) {
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer = new THREE.WebGLRenderer({
      antialias: dpr < 1.5,
      powerPreference: "high-performance",
    });
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
    el.className = "board-canvas";
    el.setAttribute("aria-hidden", "true");
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.makeMaterials();
    this.makeSky();
    this.scene.fog = new THREE.Fog("#000", 190, 520);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -125;
    sc.right = sc.top = 125;
    sc.near = 10;
    sc.far = 420;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.4;
    this.scene.add(this.sun, this.sun.target, this.hemi);
    const t0 = performance.now();
    this.build();
    const w = window as unknown as {
      __stixxBuildMs?: number;
      __stixxBoard?: BoardRenderer;
    };
    w.__stixxBuildMs = performance.now() - t0;
    // Exposed for the inspect-runtime workflow and automated checks.
    w.__stixxBoard = this;
    this.scene.add(this.dynamic, this.focusLayer, this.figures);
    this.buildToken();
    this.setTimeOfDay("dusk");
    this.bindInput(el);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.attach(host);
  }

  // ---- lifecycle -------------------------------------------------------------
  attach(host: HTMLElement) {
    this.host = host;
    host.prepend(this.renderer.domElement);
    this.resizeObserver?.disconnect();
    this.observer?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.observer = new IntersectionObserver(
      ([e]) => {
        this.visible = e.isIntersecting;
        if (this.visible) this.start();
      },
      { threshold: 0.01 },
    );
    this.observer.observe(host);
    this.visible = true;
    this.resize();
    this.wake();
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
    this.onLevel = () => {};
  }

  // ---- public API --------------------------------------------------------------
  setView(view: BoardView) {
    this.view = view;
    this.rebuildDynamic();
    this.wake();
  }
  setLens(lens: Lens) {
    if (lens === this.lens) return;
    this.lens = lens;
    this.rebuildDynamic();
    this.wake();
  }
  /** Move the camera to a level of the board and highlight what's selected. */
  setFocus(focus: Focus, fly = true) {
    const prev = this.focus;
    this.focus = { ...focus };
    this.rebuildFocus();
    if (this.view && prev.zone !== focus.zone) this.rebuildDynamic();
    if (fly) {
      const place = focus.place
        ? LOCATIONS.find((l) => l.id === focus.place)
        : null;
      const block = focus.block ? blockById(focus.block) : null;
      if (place) {
        const [x, z] = locationPosition(place);
        this.flyTo(
          x,
          z + 2,
          LEVEL_DISTANCE.place * (this.camera.aspect < 1 ? 1.2 : 1),
        );
      } else if (block) {
        this.flyTo(
          (block.minX + block.maxX) / 2,
          (block.minZ + block.maxZ) / 2 + 2,
          LEVEL_DISTANCE.block * (this.camera.aspect < 1 ? 1.25 : 1),
        );
      } else if (focus.zone) {
        const [x, z] = districtCenter(focus.zone);
        // Portrait phones need more distance to frame a whole district.
        const portrait = this.camera.aspect < 1 ? 1.35 : 1;
        this.flyTo(
          x,
          z + 6,
          (focus.zone === "downtown" ? 92 : LEVEL_DISTANCE.district) * portrait,
        );
      } else this.flyTo(0, 12, LEVEL_DISTANCE.city, 0);
    }
    this.wake();
  }
  /** Reserve screen space for HUD and sheet so the focus stays visible. */
  setInsets(top: number, bottom: number) {
    if (
      Math.abs(top - this.insets.top) < 1 &&
      Math.abs(bottom - this.insets.bottom) < 1
    )
      return;
    this.insets = { top, bottom };
    this.applyViewOffset();
    this.wake();
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
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    // Lambert shading without environment light needs extra fill.
    this.hemi.intensity = t.hemi * (this.lite ? 1.45 : 1);
    (this.scene.fog as THREE.Fog).color.set(t.fog);
    this.facadeMat.emissiveIntensity = t.windows;
    this.signMat.emissiveIntensity = t.signs;
    this.tagMat.emissiveIntensity = t.signs * 0.4;
    this.glowMat.color.setScalar(time === "day" ? 0.55 : 1);
    this.lampPoolMat.opacity = 0.55 * t.lamps;
    this.lampHeadMat.color.set(t.lamps ? "#ffd9a0" : "#8c8a84");
    this.renderer.toneMappingExposure = t.exposure;
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
  /** Where a place's front door is: the piece and people stand here. */
  static frontOf(placeId: string): [number, number] {
    const l = LOCATIONS.find((l) => l.id === placeId)!;
    const [x, z] = locationPosition(l);
    const b = locationBlock(l);
    return [x, b && !b.waterfront ? b.maxZ + 1.3 : z + 3];
  }
  /** Put the player's piece somewhere without animating. */
  placeToken(placeId: string | null) {
    if (!placeId) return;
    const [x, z] = BoardRenderer.frontOf(placeId);
    this.token.position.set(x, 0, z);
    this.tokenWalk = null;
    this.wake();
  }
  /** Walk the player's piece along the streets to a place; resolves on arrival. */
  walkTo(placeId: string): Promise<void> {
    const [tx, tz] = BoardRenderer.frontOf(placeId);
    const fx = this.token.position.x,
      fz = this.token.position.z;
    if (Math.hypot(tx - fx, tz - fz) < 0.5 || this.reducedMotion) {
      this.placeToken(placeId);
      return Promise.resolve();
    }
    const path: [number, number][] = [
      [fx, fz],
      [fx, tz],
      [tx, tz],
    ];
    let total = 0;
    for (let i = 1; i < path.length; i++)
      total += Math.hypot(
        path[i][0] - path[i - 1][0],
        path[i][1] - path[i - 1][1],
      );
    return new Promise((resolve) => {
      this.tokenWalk = { path, t: 0, total, done: resolve };
      this.wake();
    });
  }
  /** World position (for HTML overlays) of a person standing at a place. */
  personSpot(placeId: string, slot: number): THREE.Vector3 {
    const [x, z] = BoardRenderer.frontOf(placeId);
    const ox = ((slot % 3) - 1) * 1.7 + 1.4,
      oz = Math.floor(slot / 3) * 1.3 + 0.4;
    return new THREE.Vector3(x + ox, 1.7, z + oz);
  }
  /** Characters standing at places: one figure each, in their colors. */
  setFigures(
    list: { id: string; placeId: string; slot: number; color: string }[],
  ) {
    this.clear(this.figures);
    if (!list.length) return;
    const geo = new THREE.CapsuleGeometry(0.26, 0.66, 3, 8).translate(
      0,
      0.58,
      0,
    );
    const mesh = new THREE.InstancedMesh(geo, this.plainMat, list.length);
    list.forEach((f, i) => {
      const v = this.personSpot(f.placeId, f.slot);
      mesh.setMatrixAt(i, placed(v.x, CURB, v.z));
      mesh.setColorAt(i, col(f.color));
    });
    this.figures.add(mesh);
    this.wake();
  }
  /** A quick night-and-back pulse when the day ends. */
  passDay() {
    const keep = this.time;
    this.timeApplied = false;
    this.setTimeOfDay("night");
    window.setTimeout(() => {
      this.timeApplied = false;
      this.setTimeOfDay(keep);
    }, 1400);
  }
  /** Rebuild the player's figure from the character's appearance. */
  setAppearance(a: Appearance) {
    const key = JSON.stringify(a);
    if (key === this.appearanceKey) return;
    this.appearanceKey = key;
    this.clear(this.tokenBody);
    this.tokenBody.add(buildFigure(a));
    if (a.model)
      void loadFigureModel(`${import.meta.env.BASE_URL}${a.model}`)
        .then((m) => {
          if (this.appearanceKey !== key) return;
          this.clear(this.tokenBody);
          this.tokenBody.add(m);
          this.wake();
        })
        .catch(() => {});
    this.wake();
  }
  /** Face the direction of travel. */
  private faceToward(dx: number, dz: number) {
    if (Math.abs(dx) + Math.abs(dz) > 0.001)
      this.tokenBody.rotation.y = Math.atan2(dx, dz);
  }
  setTokenColor(hex: string) {
    this.tokenRing.color.set(hex);
  }
  overview() {
    this.setFocus({ zone: this.focus.zone, block: null, place: null }, false);
    this.flyTo(0, 12, LEVEL_DISTANCE.city, 0);
  }
  get debugState() {
    return {
      target: this.target.toArray(),
      distance: this.distance,
      yaw: this.yaw,
      insets: this.insets,
      focus: this.focus,
      flight: !!this.flight,
    };
  }
  get cameraDistance() {
    return this.distance;
  }
  registerOverlay(a: OverlayAnchor) {
    this.overlays = this.overlays.filter((o) => o.key !== a.key);
    this.overlays.push(a);
    this.wake();
  }
  unregisterOverlay(key: string) {
    this.overlays = this.overlays.filter((o) => o.key !== key);
  }
  static anchorFor(kind: "zone" | "place", id: string) {
    if (kind === "zone") {
      const [x, z] = districtCenter(id as ZoneId);
      return new THREE.Vector3(x, 12, z - 4);
    }
    const l = LOCATIONS.find((l) => l.id === id)!;
    const [x, z] = locationPosition(l);
    return new THREE.Vector3(x, placeHeight(l) + 2, z);
  }
  resize() {
    const w = this.host.clientWidth || 1,
      h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 52 : 40;
    this.applyViewOffset();
    this.wake();
  }
  dispose() {
    this.disposed = true;
    if (BoardRenderer.instance === this) BoardRenderer.instance = null;
    this.detach();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.renderer.dispose();
  }

  // ---- materials, sky ---------------------------------------------------------
  private makeMaterials() {
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
      side: THREE.DoubleSide,
    });
    this.groundMat = lit({ color: "#34353a", roughness: 0.5, metalness: 0.15 });
    this.waterMat = lit({ color: "#1d3a44", roughness: 0.12, metalness: 0.7 });
    this.signMat = lit({
      map: this.atlas.texture,
      emissiveMap: this.atlas.texture,
      emissive: new THREE.Color("#ffffff"),
      roughness: 0.7,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.tagMat = lit({
      map: this.atlas.texture,
      emissiveMap: this.atlas.texture,
      emissive: new THREE.Color("#ffffff"),
      transparent: true,
      alphaTest: 0.35,
      depthWrite: false,
      roughness: 0.9,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
  }
  private makeSky() {
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
  }

  // ---- static city --------------------------------------------------------------
  private addKit(k: Kit, shadows = true) {
    const meshes: THREE.Mesh[] = [];
    if (!k.facade.empty)
      meshes.push(new THREE.Mesh(k.facade.build(), this.facadeMat));
    if (!k.plain.empty)
      meshes.push(new THREE.Mesh(k.plain.build(), this.plainMat));
    if (!k.glow.empty)
      meshes.push(new THREE.Mesh(k.glow.build(), this.glowMat));
    if (!k.sign.empty)
      meshes.push(new THREE.Mesh(k.sign.build(), this.signMat));
    for (const m of meshes) {
      const casts =
        m.material === this.facadeMat || m.material === this.plainMat;
      m.castShadow = shadows && casts;
      m.receiveShadow = casts || m.material === this.signMat;
      this.scene.add(m);
    }
  }
  private nearRiver(x: number, z: number, pad: number) {
    return distanceToPath(this.river, x, z) < RIVER_WIDTH / 2 + pad;
  }
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
    for (const l of LOCATIONS) {
      const [x, z] = locationPosition(l),
        h = placeHeight(l);
      const picker = new THREE.Mesh(
        new THREE.CylinderGeometry(3.8, 3.8, h + 2, 8).translate(
          0,
          (h + 2) / 2,
          0,
        ),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      picker.position.set(x, 0, z);
      picker.userData.place = l.id;
      this.placePickers.push(picker);
      this.scene.add(picker);
    }
    this.renderer.shadowMap.needsUpdate = true;
  }
  private buildRiver() {
    const g = new Geo(),
      banks = kit(91),
      w = RIVER_WIDTH / 2,
      path = this.river;
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i],
        [bx, bz] = path[i + 1];
      const dx = bx - ax,
        dz = bz - az,
        l = Math.hypot(dx, dz) || 1,
        nx = -dz / l,
        nz = dx / l,
        ex = (dx / l) * 0.3,
        ez = (dz / l) * 0.3;
      g.quad(
        [ax + nx * w - ex, 0.06, az + nz * w - ez],
        [ax - nx * w - ex, 0.06, az - nz * w - ez],
        [bx - nx * w + ex, 0.06, bz - nz * w + ez],
        [bx + nx * w + ex, 0.06, bz + nz * w + ez],
        col("#ffffff"),
      );
      for (const side of [1, -1])
        box(banks, {
          x: (ax + bx) / 2 + nx * (w + 0.35) * side,
          z: (az + bz) / 2 + nz * (w + 0.35) * side,
          w: l + 0.4,
          d: 0.7,
          h: 0.55,
          y: 0,
          rot: Math.atan2(-dz, dx),
          color: col("#5f5b55"),
          windows: false,
        });
    }
    const waterGeo = g.build();
    waterGeo.deleteAttribute("color");
    const mesh = new THREE.Mesh(waterGeo, this.waterMat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const lines = [
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
        const rot = line.axis === "x" ? Math.PI / 2 : 0;
        box(banks, {
          x,
          z,
          w: RIVER_WIDTH + 5,
          d: 4.2,
          h: 0.35,
          y: 0.45,
          rot,
          color: col("#4c4d50"),
          windows: false,
        });
        for (const side of [-1, 1])
          box(banks, {
            x: x + (rot ? side * 2 : 0),
            z: z + (rot ? 0 : side * 2),
            w: RIVER_WIDTH + 5,
            d: 0.18,
            h: 0.5,
            y: 0.8,
            rot,
            color: col("#7b6f62"),
            windows: false,
          });
      }
    this.addKit(banks);
  }
  private buildDistrict(zone: ZoneId) {
    const d = DISTRICTS[zone],
      style = DISTRICT_STYLE[zone],
      grid = districtGrid(zone),
      k = kit(hash(zone));
    this.streets[zone] = { xs: grid.streetsX, zs: grid.streetsZ };
    const trainZ =
      zone === "nawf" ? d.minZ + (d.maxZ - d.minZ) * 0.33 : Number.NaN;
    if (zone === "nawf") this.trainZ = trainZ;
    for (const b of grid.blocks) {
      k.block = b.id;
      const cx = (b.minX + b.maxX) / 2,
        cz = (b.minZ + b.maxZ) / 2;
      const here = LOCATIONS.filter((l) => locationBlock(l)?.id === b.id);
      if (b.waterfront && !here.length) {
        waterfront(k, zone, b, (x, z, p) => this.nearRiver(x, z, p));
        continue;
      }
      if (!b.waterfront)
        box(k, {
          x: cx,
          z: cz,
          w: b.maxX - b.minX,
          d: b.maxZ - b.minZ,
          h: CURB,
          y: 0,
          color: col(style.sidewalk),
          windows: false,
        });
      let exclude: Rect | null = null;
      for (const l of here) {
        if (l.model) {
          this.loadModel(l, b);
          exclude = { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
          continue;
        }
        exclude = buildLocation(k, this.atlas, l, b, {
          trainZ,
          scene: (o) => this.scene.add(o),
        });
      }
      const fullyUsed =
        exclude &&
        exclude.maxX - exclude.minX >= b.maxX - b.minX - 0.1 &&
        exclude.maxZ - exclude.minZ >= b.maxZ - b.minZ - 0.1;
      if (!fullyUsed && !b.waterfront)
        fillBlock(
          k,
          zone,
          b,
          exclude,
          zone === "nawf" && Math.abs(cz - trainZ) < (b.maxZ - b.minZ) / 2 + 1
            ? trainZ
            : Number.NaN,
        );
    }
    k.block = null;
    if (zone === "nawf") this.buildElevatedTrain(k, d, trainZ);
    for (const w of k.walls) {
      if (!w.block) continue;
      const list = this.walls.get(w.block) ?? [];
      list.push(w);
      this.walls.set(w.block, list);
    }
    for (const roof of k.roofs) {
      const b = blockAt(roof[0], roof[2]);
      if (!b) continue;
      const list = this.roofs.get(b.id) ?? [];
      list.push(roof);
      this.roofs.set(b.id, list);
    }
    this.addKit(k);
  }
  /** Optional GLB replacement for a location (see LocationDef.model). */
  private loadModel(l: LocationDef, b: BlockDef) {
    void import("three/examples/jsm/loaders/GLTFLoader.js").then(
      ({ GLTFLoader }) => {
        new GLTFLoader().load(
          `${import.meta.env.BASE_URL}${l.model}`,
          (gltf) => {
            const root = gltf.scene;
            const size = new THREE.Box3()
              .setFromObject(root)
              .getSize(new THREE.Vector3());
            const fit =
              Math.min(
                (b.maxX - b.minX) / (size.x || 1),
                (b.maxZ - b.minZ) / (size.z || 1),
              ) * 0.9;
            root.scale.setScalar(fit);
            const [x, z] = locationPosition(l);
            root.position.set(x, CURB, z);
            root.traverse((o) => {
              const m = o as THREE.Mesh;
              if (m.isMesh) m.castShadow = m.receiveShadow = true;
            });
            this.scene.add(root);
            this.renderer.shadowMap.needsUpdate = true;
            this.wake();
          },
        );
      },
    );
  }
  private buildElevatedTrain(
    k: Kit,
    d: { minX: number; maxX: number },
    z: number,
  ) {
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
        });
    const train = new THREE.Group(),
      tk = kit(5);
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
    train.add(
      new THREE.Mesh(tk.plain.build(), this.plainMat),
      new THREE.Mesh(tk.glow.build(), this.glowMat),
    );
    train.position.set(from, deck + 0.55, z);
    this.scene.add(train);
    let dir = 1;
    this.animated.push((_, dt) => {
      train.position.x += dir * dt * 7;
      if (train.position.x > to - 13) dir = -1;
      if (train.position.x < from) dir = 1;
    });
  }
  private buildFiller() {
    const k = kit(4242),
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
        });
        box(k, {
          x: cx,
          z: cz,
          w: step - 5 - k.r() * 2,
          d: step - 5 - k.r() * 2,
          h: 0.9 * floors,
          color: col(pick(k.r, wall)),
        });
      }
    this.addKit(k);
  }
  private buildStreetFurniture() {
    const lamps: [number, number][] = [];
    for (const zone of ZONE_ORDER) {
      const d = DISTRICTS[zone];
      for (let x = d.minX; x <= d.maxX; x += 8)
        lamps.push([x, d.minZ - 0.4], [x, d.maxZ + 0.4]);
      for (let z = d.minZ + 8; z < d.maxZ; z += 8)
        lamps.push([d.minX - 0.4, z], [d.maxX + 0.4, z]);
      for (const sx of this.streets[zone].xs)
        for (let z = d.minZ + 6; z < d.maxZ; z += 10) lamps.push([sx + 1.3, z]);
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
    // Power poles and wires along Rio and Reservoir streets (from the references).
    const k = kit(33);
    for (const zone of ["rio", "reservoir", "south"] as ZoneId[]) {
      const d = DISTRICTS[zone];
      for (const z of [d.minZ - 1.2, d.maxZ + 1.2]) {
        let prev: [number, number] | null = null;
        for (let x = d.minX; x <= d.maxX; x += 9) {
          if (this.nearRiver(x, z, 1)) {
            prev = null;
            continue;
          }
          box(k, {
            x,
            z,
            w: 0.18,
            d: 0.18,
            h: 5.2,
            y: 0,
            color: col("#5a4636"),
            windows: false,
          });
          box(k, {
            x,
            z,
            w: 1.4,
            d: 0.1,
            h: 0.1,
            y: 4.8,
            color: col("#5a4636"),
            windows: false,
          });
          if (prev)
            box(k, {
              x: (prev[0] + x) / 2,
              z,
              w: x - prev[0],
              d: 0.03,
              h: 0.03,
              y: 4.6,
              color: col("#1a1a1a"),
              windows: false,
            });
          prev = [x, z];
        }
      }
    }
    this.addKit(k, false);
    const dashes: [number, number, number][] = [];
    for (const ax of AVENUES_X)
      for (let z = BOARD.minZ; z < BOARD.maxZ; z += 4)
        dashes.push([ax, z, Math.PI / 2]);
    for (const az of AVENUES_Z)
      for (let x = BOARD.minX; x < BOARD.maxX; x += 4) dashes.push([x, az, 0]);
    const kept = dashes.filter(([x, z]) => !this.nearRiver(x, z, 0.5));
    const dashMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.4, 0.16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: "#a88a3a" }),
      kept.length,
    );
    kept.forEach(([x, z, r], i) =>
      dashMesh.setMatrixAt(i, placed(x, 0.03, z, 1, 1, 1, r)),
    );
    this.scene.add(dashMesh);
  }
  private carGeometry() {
    const k = kit(1);
    box(k, {
      x: 0,
      z: 0,
      w: 1.5,
      d: 0.72,
      h: 0.38,
      y: 0.1,
      color: col("#ffffff"),
      windows: false,
    });
    box(k, {
      x: -0.1,
      z: 0,
      w: 0.78,
      d: 0.62,
      h: 0.26,
      y: 0.48,
      color: col("#2a2f36"),
      windows: false,
    });
    return k.plain.build();
  }
  private buildTraffic() {
    const movers: Mover[] = [];
    const r = rng(77);
    for (const zone of ZONE_ORDER) {
      const d = DISTRICTS[zone];
      const base = loop(
        rectLoop(d.minX - 1.9, d.minZ - 1.9, d.maxX + 1.9, d.maxZ + 1.9),
      );
      for (let i = 0; i < 5; i++)
        movers.push({ ...base, t: r() * base.total, speed: 4 + r() * 3 });
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

  // ---- state-driven layers --------------------------------------------------------
  private clear(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat && !Array.isArray(mat) && !this.isShared(mat)) mat.dispose();
      });
    }
  }
  private isShared(m: THREE.Material) {
    return [
      this.facadeMat,
      this.plainMat,
      this.glowMat,
      this.signMat,
      this.tagMat,
      this.lampPoolMat,
      this.lampHeadMat,
    ].includes(m as never);
  }
  private rebuildDynamic() {
    this.clear(this.dynamic);
    this.dynamicAnimated = [];
    const view = this.view;
    if (!view) return;
    this.factionMarks(view);
    this.lensLayer(view);
    this.districtOutlines(view);
    this.police(view);
    this.people(view);
    this.beacons(view);
  }
  /** Tags, banners and flags, block by block, in proportion to presence. */
  private factionMarks(view: BoardView) {
    const tags = new Geo(),
      cloth = new Geo(),
      r = rng(view.day * 3 + 11);
    for (const b of Object.values(view.blocks)) {
      if (!b.faction) continue;
      const walls = this.walls.get(b.id) ?? [];
      if (!walls.length) continue;
      const t = TAGS[b.faction];
      const uv = this.atlas.tag(t.text, t.color, t.crown);
      const n = Math.min(walls.length, 1 + Math.round(b.strength * 2));
      for (let i = 0; i < n; i++) {
        const w = walls[Math.floor(r() * walls.length)];
        const tw = Math.min(w.width * 0.8, t.text.length > 3 ? 3.2 : 2);
        onWall(
          tags,
          w,
          (r() - 0.5) * (w.width - tw) * 0.6,
          CURB + 0.25 + r() * 0.5,
          tw,
          tw / 4,
          col("#ffffff"),
          uv,
          0.06 + i * 0.01,
        );
      }
      if (b.contested) {
        // A rival's tag crossing out the holder's: the feud on the walls.
        const rival = (Object.keys(TAGS) as FactionId[]).find(
          (f) =>
            f !== b.faction &&
            view.zones[b.zone].presence.some((p) => p.faction === f),
        );
        if (rival) {
          const rt = TAGS[rival];
          const w = walls[Math.floor(r() * walls.length)];
          onWall(
            tags,
            w,
            0,
            CURB + 1.1,
            2.4,
            0.6,
            col("#ffffff"),
            this.atlas.tag(rt.text, rt.color, rt.crown),
            0.1,
          );
        }
      }
      if (b.strength > 0.45) {
        // Banners hanging from upper floors.
        const w = walls[Math.floor(r() * walls.length)];
        if (w.top > 2.5) {
          const [c1, c2] = t.cloth;
          onWall(
            cloth,
            w,
            (r() - 0.5) * w.width * 0.4,
            w.top - 1.9,
            0.7,
            1.4,
            col(c1),
            undefined,
            0.08,
          );
          onWall(
            cloth,
            w,
            (r() - 0.5) * w.width * 0.4 + 0.2,
            w.top - 1.2,
            0.7,
            0.25,
            col(c2),
            undefined,
            0.09,
          );
        }
      }
    }
    if (!tags.empty) {
      const m = new THREE.Mesh(tags.build(), this.tagMat);
      m.renderOrder = 3;
      this.dynamic.add(m);
    }
    if (!cloth.empty)
      this.dynamic.add(new THREE.Mesh(cloth.build(), this.plainMat));
  }
  /** Strategy lenses: a readable block-by-block overlay on demand. */
  private lensLayer(view: BoardView) {
    if (this.lens === "streets") return;
    const pulse: THREE.MeshBasicMaterial[] = [];
    for (const block of ALL_BLOCKS) {
      if (block.waterfront && !view.blocks[block.id]?.locations.length)
        continue;
      const b = view.blocks[block.id];
      if (!b) continue;
      let color = "#000",
        opacity = 0;
      if (this.lens === "influence") {
        color = b.faction ? b.color : "#A8ADB3";
        opacity = b.faction ? 0.45 + b.strength * 0.35 : 0.15;
      } else if (this.lens === "police") {
        color =
          b.police >= 70 ? "#ff4a4a" : b.police >= 45 ? "#ffa84a" : "#7fb8ff";
        opacity = 0.3 + (b.police / 100) * 0.45;
      } else {
        const live = b.locations.filter((id) => view.places[id]?.live).length;
        color = live ? "#ffd27a" : "#2a2a2a";
        opacity = live ? 0.5 + Math.min(0.35, live * 0.15) : 0.12;
      }
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
      });
      const w = block.maxX - block.minX,
        d = block.maxZ - block.minZ;
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(w + 2.6, d + 2.6).rotateX(-Math.PI / 2),
        mat,
      );
      tile.position.set(
        (block.minX + block.maxX) / 2,
        0.29,
        (block.minZ + block.maxZ) / 2,
      );
      tile.renderOrder = 4;
      this.dynamic.add(tile);
      // A bright rim on the surrounding streets makes the lens read from afar.
      const rim = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: Math.min(1, opacity + 0.3),
        depthWrite: false,
        toneMapped: false,
      });
      const cx = (block.minX + block.maxX) / 2,
        cz = (block.minZ + block.maxZ) / 2;
      for (const [x, z, ww, dd] of [
        [cx, block.minZ - 0.9, w + 1.4, 0.5],
        [cx, block.maxZ + 0.9, w + 1.4, 0.5],
        [block.minX - 0.9, cz, 0.5, d + 1.4],
        [block.maxX + 0.9, cz, 0.5, d + 1.4],
      ]) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(ww, dd).rotateX(-Math.PI / 2),
          rim,
        );
        m.position.set(x, 0.31, z);
        m.renderOrder = 5;
        this.dynamic.add(m);
      }
      if (this.lens === "influence" && b.contested) pulse.push(mat);
    }
    if (pulse.length)
      this.dynamicAnimated.push((t) => {
        for (const m of pulse)
          m.color.set(
            Math.sin(t * 4) > 0 ? "#ff8a5a" : (m.userData.base ?? m.color),
          );
      });
    for (const m of pulse) m.userData.base = m.color.clone();
  }
  /** Quiet district outlines; the selected district reads brighter. */
  private districtOutlines(view: BoardView) {
    for (const id of ZONE_ORDER) {
      const d = DISTRICTS[id],
        sel = this.focus.zone === id;
      const mat = new THREE.MeshBasicMaterial({
        color: sel ? "#fff3d6" : "#e8dcc4",
        transparent: true,
        opacity: sel ? 0.85 : 0.22,
        toneMapped: false,
      });
      const W = d.maxX - d.minX,
        D = d.maxZ - d.minZ,
        t = sel ? 0.5 : 0.3;
      for (const [x, z, w, dd] of [
        [d.minX + W / 2, d.minZ, W, t],
        [d.minX + W / 2, d.maxZ, W, t],
        [d.minX, d.minZ + D / 2, t, D],
        [d.maxX, d.minZ + D / 2, t, D],
      ]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, dd), mat);
        m.position.set(x, 0.07, z);
        this.dynamic.add(m);
      }
      void view;
    }
  }
  private police(view: BoardView) {
    const units: Mover[] = [];
    const r = rng(view.day * 13 + 5);
    for (const id of ZONE_ORDER) {
      const z = view.zones[id],
        d = DISTRICTS[id],
        s = this.streets[id];
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
        const route = routes[i % 2];
        units.push({ ...route, t: r() * route.total, speed: 5 + r() * 2 });
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
    const bar = new THREE.BoxGeometry(0.16, 0.12, 0.26);
    const reds = new THREE.InstancedMesh(bar, red, units.length);
    const blues = new THREE.InstancedMesh(bar.clone(), blue, units.length);
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
    this.dynamicAnimated.push((t, dt) => {
      const on = Math.floor(t * 5) % 2 === 0;
      red.color.setRGB(on ? 1 : 0.18, 0.05, 0.05);
      blue.color.setRGB(0.05, 0.12, on ? 0.18 : 1);
      glowMat.color.set(on ? "#ff3030" : "#3060ff");
      glowMat.opacity =
        0.6 * (this.time === "day" ? 0.25 : this.time === "dusk" ? 0.7 : 1);
      units.forEach((u, i) => {
        u.t += u.speed * dt;
        sample(u, tmp);
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
  /** Foot traffic follows civilian support; crowds gather at faction places. */
  private people(view: BoardView) {
    const walkers: Mover[] = [];
    const r = rng(view.day * 7 + 3);
    for (const id of ZONE_ORDER) {
      const z = view.zones[id];
      const blocks = ALL_BLOCKS.filter((b) => b.zone === id && !b.waterfront);
      const n = Math.round(
        8 + (z.support / 100) * 22 + (z.commerce / 100) * 10,
      );
      for (let i = 0; i < n && blocks.length; i++) {
        const b = blocks[Math.floor(r() * blocks.length)];
        const route = loop(
          rectLoop(b.minX + 0.3, b.minZ + 0.3, b.maxX - 0.3, b.maxZ - 0.3),
        );
        walkers.push({
          ...route,
          t: r() * route.total,
          speed: (0.5 + r() * 0.6) * (r() < 0.5 ? 1 : -1),
        });
      }
    }
    const crowd: [number, number, string][] = [];
    const civilian = ["#2b2f36", "#d8d2c4", "#3a5a7a", "#1f1f1f", "#6a6a6a"];
    for (const l of LOCATIONS) {
      const b = locationBlock(l);
      const bv = b ? view.blocks[b.id] : null;
      const z = view.zones[l.zone];
      const faction = l.faction ?? bv?.faction ?? null;
      const busy =
        l.kind === "street" || l.kind === "transit"
          ? z.streetActivity / 100
          : l.kind === "hangout"
            ? 0.6
            : l.kind === "store" || l.kind === "liquor"
              ? 0.35
              : 0;
      const n = Math.round(
        busy *
          6 *
          (faction && bv?.faction === faction ? 0.6 + bv.strength * 0.6 : 0.7),
      );
      const [lx, lz] = locationPosition(l);
      const front = b ? b.maxZ + 0.6 : lz + 3;
      for (let i = 0; i < n; i++)
        crowd.push([
          lx + (r() - 0.5) * 3.4,
          front + (r() - 0.5) * 0.8,
          faction && r() < 0.65 ? TAGS[faction].cloth[0] : pick(r, civilian),
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
        w.t += w.speed * dt;
        sample(w, tmp);
        people.setMatrixAt(i, placed(tmp.x, CURB, tmp.z));
      });
      people.instanceMatrix.needsUpdate = true;
    });
  }
  private beacons(view: BoardView) {
    for (const l of LOCATIONS) {
      const st = view.places[l.id];
      if (!st?.owned && !st?.employed && !st?.home) continue;
      const [x, z] = locationPosition(l);
      const color = st.owned
        ? view.playerAccent
        : st.employed
          ? "#f5e6c8"
          : view.playerAccent;
      const h = st.owned ? 26 : st.employed ? 16 : 10;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, h, 10, 1, true).translate(
          0,
          h / 2,
          0,
        ),
        mat,
      );
      beam.position.set(x, 0, z);
      this.dynamic.add(beam);
      this.dynamicAnimated.push((t) => {
        mat.opacity = 0.25 + 0.12 * Math.sin(t * 2 + x);
      });
    }
  }
  private rebuildFocus() {
    this.clear(this.focusLayer);
    this.focusAnimated = [];
    const ringMat = new THREE.MeshBasicMaterial({
      color: "#fff3d6",
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    const block = this.focus.block ? blockById(this.focus.block) : null;
    if (block) {
      const W = block.maxX - block.minX + 1.4,
        D = block.maxZ - block.minZ + 1.4,
        cx = (block.minX + block.maxX) / 2,
        cz = (block.minZ + block.maxZ) / 2;
      for (const [x, z, w, d] of [
        [cx, cz - D / 2, W, 0.35],
        [cx, cz + D / 2, W, 0.35],
        [cx - W / 2, cz, 0.35, D],
        [cx + W / 2, cz, 0.35, D],
      ]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), ringMat);
        m.position.set(x, 0.32, z);
        this.focusLayer.add(m);
      }
    }
    const place = this.focus.place
      ? LOCATIONS.find((l) => l.id === this.focus.place)
      : null;
    if (place) {
      const [x, z] = locationPosition(place);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.6, 4.1, 40).rotateX(-Math.PI / 2),
        ringMat,
      );
      ring.position.set(x, 0.34, z);
      this.focusLayer.add(ring);
    }
    if (block || place)
      this.focusAnimated.push((t) => {
        ringMat.opacity = 0.55 + 0.4 * Math.sin(t * 4);
      });
  }

  private buildToken() {
    this.setAppearance(DEFAULT_APPEARANCE);
    this.tokenRing = new THREE.MeshBasicMaterial({
      color: "#fff3d6",
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 32).rotateX(-Math.PI / 2),
      this.tokenRing,
    );
    ring.position.y = 0.32;
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color: "#fff3d6", toneMapped: false }),
    );
    marker.position.y = 2.7;
    this.tokenBody.scale.setScalar(0.85);
    this.token.add(this.tokenBody, ring, marker);
    this.token.position.set(0, 0, 60);
    this.scene.add(this.token);
    this.animated.push((t, dt) => {
      marker.position.y = 2.7 + Math.sin(t * 3) * 0.18;
      marker.rotation.y += dt * 2;
      this.tokenRing.opacity = 0.6 + 0.3 * Math.sin(t * 4);
      const w = this.tokenWalk;
      if (!w) return;
      w.t = Math.min(w.total, w.t + dt * Math.max(14, w.total / 1.4));
      let d = w.t;
      for (let i = 1; i < w.path.length; i++) {
        const [ax, az] = w.path[i - 1],
          [bx, bz] = w.path[i];
        const l = Math.hypot(bx - ax, bz - az);
        if (d <= l || i === w.path.length - 1) {
          const f = l ? Math.min(1, d / l) : 1;
          this.token.position.set(
            ax + (bx - ax) * f,
            Math.abs(Math.sin(w.t * 2.2)) * 0.12,
            az + (bz - az) * f,
          );
          this.faceToward(bx - ax, bz - az);
          break;
        }
        d -= l;
      }
      if (w.t >= w.total) {
        this.tokenWalk = null;
        this.token.position.y = 0;
        this.tokenBody.rotation.y = 0;
        w.done();
      }
    });
  }

  // ---- camera & input ------------------------------------------------------------
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
    const f = THREE.MathUtils.clamp((this.distance - 30) / 180, 0, 1);
    return THREE.MathUtils.lerp(0.42, 0.68, f);
  }
  private applyViewOffset() {
    const w = this.host?.clientWidth || 1,
      h = this.host?.clientHeight || 1;
    const visibleCenter =
      this.insets.top + (h - this.insets.top - this.insets.bottom) / 2;
    const dy = h / 2 - visibleCenter;
    if (Math.abs(dy) < 1) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, 0, dy, w, h);
    this.camera.updateProjectionMatrix();
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
  private ray(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
  }
  private groundAt(clientX: number, clientY: number) {
    this.ray(clientX, clientY);
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
      if (this.pointers.size === 1)
        this.gesture = {
          moved: 0,
          start: performance.now(),
          groundStart: this.groundAt(e.clientX, e.clientY) ?? undefined,
        };
      else if (this.pointers.size === 2 && this.gesture) {
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
          22,
          260,
        );
        this.yaw = g.pinch.yaw - (angle - g.pinch.angle);
      } else if (e.buttons === 2 || e.shiftKey) {
        this.yaw -= (e.clientX - prev.x) * 0.008;
      } else if (g.groundStart) {
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
        const [p] = [...this.pointers.values()];
        g.pinch = undefined;
        g.groundStart = this.groundAt(p.x, p.y) ?? undefined;
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
          22,
          260,
        );
        this.wake();
      },
      { passive: false },
    );
  }
  /**
   * Tap rules: far away a tap picks a district; closer it picks a block;
   * close enough to read signs it picks the place itself.
   */
  private pickAt(clientX: number, clientY: number) {
    this.ray(clientX, clientY);
    if (this.distance < 120) {
      const hit = this.raycaster.intersectObjects(this.placePickers, false)[0];
      if (hit) {
        const l = LOCATIONS.find((l) => l.id === hit.object.userData.place)!;
        this.onPick({
          zone: l.zone,
          block: locationBlock(l)?.id ?? null,
          place: l.id,
        });
        return;
      }
    }
    const ground = this.groundAt(clientX, clientY);
    if (!ground) return;
    const block = blockAt(ground.x, ground.z);
    const zone =
      block?.zone ??
      ZONE_ORDER.find((id) => {
        const d = DISTRICTS[id];
        return (
          ground.x >= d.minX &&
          ground.x <= d.maxX &&
          ground.z >= d.minZ &&
          ground.z <= d.maxZ
        );
      }) ??
      null;
    if (!zone) return this.onPick({ zone: null, block: null, place: null });
    if (this.distance < 150 && block && this.focus.zone === zone)
      this.onPick({ zone, block: block.id, place: null });
    else this.onPick({ zone, block: null, place: null });
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
      now - this.lastActive < 1200 ||
      this.pointers.size > 0 ||
      !!this.flight ||
      !!this.tokenWalk;
    if (!active && (this.lite || this.reducedMotion)) {
      this.running = false;
      cancelAnimationFrame(this.frame);
      return;
    }
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
    for (const a of this.focusAnimated) a(this.clock, dt);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.positionOverlays();
    if (Math.abs(this.distance - this.lastLevelDistance) > 4) {
      this.lastLevelDistance = this.distance;
      this.onLevel(this.distance);
    }
  };
  private positionOverlays() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight,
      v = new THREE.Vector3();
    for (const o of this.overlays) {
      v.copy(o.position).project(this.camera);
      const far =
        (o.maxDistance !== undefined && this.distance > o.maxDistance) ||
        (o.minDistance !== undefined && this.distance < o.minDistance);
      const x = (v.x * 0.5 + 0.5) * w,
        y = (-v.y * 0.5 + 0.5) * h;
      const off =
        v.z > 1 ||
        far ||
        x < -40 ||
        x > w + 40 ||
        y - (o.clearance ?? 0) < this.insets.top - 6 ||
        y > h - this.insets.bottom + 30;
      o.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      o.element.style.opacity = off ? "0" : "1";
      o.element.style.pointerEvents = off ? "none" : "";
      o.element.style.visibility = off ? "hidden" : "visible";
    }
  }
}

export function placeHeight(l: LocationDef) {
  switch (l.archetype) {
    case "towers":
      return 18.5;
    case "projects":
      return 11;
    case "cityhall":
      return 9;
    case "station":
      return 7.6;
    case "watertower":
      return 15;
    case "mission":
    case "church":
      return 7;
    case "docks":
      return 6;
    default:
      return l.zone === "downtown" ? 6.5 : l.zone === "nawf" ? 4.8 : 3.2;
  }
}
