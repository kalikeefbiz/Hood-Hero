import * as THREE from "three";

// Geometry kit: everything static is accumulated into a few merged meshes.
export type V3 = [number, number, number];
export const FLOOR = 0.9,
  BAY = 0.9,
  TILE = 16,
  CURB = 0.25;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T>(r: () => number, list: readonly T[]) =>
  list[Math.floor(r() * list.length) % list.length];
export const col = (hex: string) => new THREE.Color(hex);
export const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export class Geo {
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
export function normal(a: V3, b: V3, c: V3): V3 {
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

/** A wall surface where signage, tags and banners can be mounted. */
export interface WallSlot {
  x: number;
  z: number;
  /** Outward normal on the ground plane. */
  nx: number;
  nz: number;
  width: number;
  top: number;
  block: string | null;
}
export interface Kit {
  facade: Geo;
  plain: Geo;
  glow: Geo;
  sign: Geo;
  roofs: V3[];
  walls: WallSlot[];
  r: () => number;
  block: string | null;
}
export const kit = (seed: number): Kit => ({
  facade: new Geo(),
  plain: new Geo(),
  glow: new Geo(),
  sign: new Geo(),
  roofs: [],
  walls: [],
  r: rng(seed),
  block: null,
});

export interface BoxOptions {
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
  /** Register roof + street-facing walls for faction marks. */
  record?: boolean;
}
export function box(k: Kit, o: BoxOptions) {
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
    const a = at(ax, az, y0),
      b = at(bx, bz, y0);
    target.quad(a, b, at(bx, bz, y1), at(ax, az, y1), o.color, [
      uo,
      vo + y0 / (FLOOR * TILE),
      uo + len / (BAY * TILE),
      vo + y1 / (FLOOR * TILE),
    ]);
    if (o.record && o.h > 1.4 && len > 1.6) {
      const n = normal(a, b, at(ax, az, y1));
      k.walls.push({
        x: (a[0] + b[0]) / 2,
        z: (a[2] + b[2]) / 2,
        nx: n[0],
        nz: n[2],
        width: len,
        top: y1,
        block: k.block,
      });
    }
  }
  k.plain.quad(
    at(corners[0][0], corners[0][1], y1),
    at(corners[1][0], corners[1][1], y1),
    at(corners[2][0], corners[2][1], y1),
    at(corners[3][0], corners[3][1], y1),
    o.roof ?? o.color.clone().multiplyScalar(0.62),
  );
  if (o.record && o.h > 1.2) k.roofs.push([o.x, y1, o.z]);
  return y1;
}
export function gable(
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
/** A flat quad on a wall facing +z (toward the default camera). */
export function front(
  g: Geo,
  x: number,
  z: number,
  y: number,
  w: number,
  h: number,
  cl: THREE.Color,
  uv?: [number, number, number, number],
) {
  g.quad(
    [x - w / 2, y, z],
    [x + w / 2, y, z],
    [x + w / 2, y + h, z],
    [x - w / 2, y + h, z],
    cl,
    uv,
  );
}
/** A quad mounted on an arbitrary wall slot (normal on the ground plane). */
export function onWall(
  g: Geo,
  s: { x: number; z: number; nx: number; nz: number },
  along: number,
  y: number,
  w: number,
  h: number,
  cl: THREE.Color,
  uv?: [number, number, number, number],
  out = 0.04,
) {
  const rx = s.nz,
    rz = -s.nx;
  const cx = s.x + s.nx * out + rx * along,
    cz = s.z + s.nz * out + rz * along;
  g.quad(
    [cx - (rx * w) / 2, y, cz - (rz * w) / 2],
    [cx + (rx * w) / 2, y, cz + (rz * w) / 2],
    [cx + (rx * w) / 2, y + h, cz + (rz * w) / 2],
    [cx - (rx * w) / 2, y + h, cz - (rz * w) / 2],
    cl,
    uv,
  );
}

const M = new THREE.Matrix4(),
  Q = new THREE.Quaternion(),
  S = new THREE.Vector3(),
  P = new THREE.Vector3(),
  E = new THREE.Euler();
/** Shared matrix: callers must consume it immediately. */
export function placed(
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  ry = 0,
) {
  Q.setFromEuler(E.set(0, ry, 0));
  return M.compose(P.set(x, y, z), Q, S.set(sx, sy, sz));
}
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 7, 1),
  CONE = new THREE.ConeGeometry(1, 1, 6, 1),
  BLOB = new THREE.IcosahedronGeometry(1, 0),
  DOME = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);

export function tree(k: Kit, x: number, z: number, scale = 1, bare = false) {
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
    col(pick(k.r, ["#3f5a35", "#4c6338", "#36502f"])),
  );
}
export function palm(k: Kit, x: number, z: number, tall = 1) {
  const h = (3.6 + k.r() * 1.8) * tall;
  k.plain.geometry(
    CYL,
    placed(x, CURB + h / 2, z, 0.09, h, 0.09),
    col("#6b5640"),
  );
  for (let i = 0; i < 6; i++)
    k.plain.geometry(
      CONE,
      placed(x, CURB + h - 0.1, z, 0.22, 1.5, 0.22).multiply(
        new THREE.Matrix4().makeRotationFromEuler(
          new THREE.Euler(Math.PI / 2.4, (i / 6) * Math.PI * 2, 0, "YXZ"),
        ),
      ),
      col("#4f6b3a"),
    );
}
export function carBody(
  k: Kit,
  x: number,
  z: number,
  rot: number,
  hex: string,
  low = false,
) {
  box(k, {
    x,
    z,
    w: 1.5,
    d: 0.7,
    h: low ? 0.28 : 0.36,
    y: 0.08,
    rot,
    color: col(hex),
    windows: false,
  });
  box(k, {
    x: x - Math.cos(rot) * 0.1,
    z: z + Math.sin(rot) * 0.1,
    w: 0.75,
    d: 0.6,
    h: 0.26,
    y: low ? 0.36 : 0.44,
    rot,
    color: col("#1b2027"),
    windows: false,
  });
}
export function fence(
  k: Kit,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h = 1.1,
) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  box(k, {
    x: (x0 + x1) / 2,
    z: (z0 + z1) / 2,
    w: len,
    d: 0.05,
    h,
    rot: Math.atan2(-(z1 - z0), x1 - x0),
    color: col("#8a8d8f"),
    windows: false,
  });
}
