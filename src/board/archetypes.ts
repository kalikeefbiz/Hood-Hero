import * as THREE from "three";
import type { ZoneId } from "../core/GameState";
import type { BlockDef } from "../city3d/layout";
import { locationPosition } from "../city3d/layout";
import type { LocationDef } from "./locations";
import {
  BLOB,
  CONE,
  CURB,
  CYL,
  DOME,
  FLOOR,
  box,
  carBody,
  col,
  fence,
  front,
  gable,
  palm,
  pick,
  placed,
  tree,
  type Kit,
} from "./geo";
import type { SignAtlas } from "./textures";

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const overlaps = (a: Rect, b: Rect) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

// ---------------------------------------------------------------------------
// District architecture. Each district has its own building vocabulary taken
// from the environment references.
// ---------------------------------------------------------------------------
export const DISTRICT_STYLE: Record<
  ZoneId,
  { walls: string[]; sidewalk: string; trees: number }
> = {
  downtown: {
    walls: ["#c9c2b4", "#8fa3b5", "#6f8296", "#b4ab9b", "#a6b6c4", "#d6cfc0"],
    sidewalk: "#8b8a86",
    trees: 0.3,
  },
  nawf: {
    walls: ["#8a4a36", "#9b5a3e", "#7a3f30", "#b0805c", "#6e3b2f", "#a8664a"],
    sidewalk: "#7f7b76",
    trees: 0.35,
  },
  south: {
    walls: ["#7c4434", "#8c5442", "#6a3c32", "#9a6a52", "#5e3a31"],
    sidewalk: "#6f6c68",
    trees: 0.45,
  },
  reservoir: {
    walls: [
      "#b9b2a2",
      "#8d9a9a",
      "#a69683",
      "#c2b08c",
      "#7f8b84",
      "#9e8a7c",
      "#7a6e8a",
    ],
    sidewalk: "#75736c",
    trees: 0.75,
  },
  rio: {
    walls: [
      "#e3c9a0",
      "#d9a185",
      "#e9d6b4",
      "#c98f6a",
      "#e0c8a0",
      "#d6b48a",
      "#c9b79a",
    ],
    sidewalk: "#8f857a",
    trees: 0.55,
  },
};

const awning = (
  k: Kit,
  x: number,
  z: number,
  w: number,
  y: number,
  a: string,
  striped: boolean,
) => {
  const n = striped ? Math.max(3, Math.round(w / 0.5)) : 1;
  for (let i = 0; i < n; i++) {
    const sw = w / n;
    box(k, {
      x: x - w / 2 + sw * (i + 0.5),
      z: z + 0.45,
      w: sw,
      d: 0.9,
      h: 0.12,
      y,
      color: col(striped && i % 2 ? "#f3efe4" : a),
      windows: false,
    });
  }
  // Valance.
  box(k, {
    x,
    z: z + 0.88,
    w,
    d: 0.04,
    h: 0.28,
    y: y - 0.2,
    color: col(a),
    windows: false,
  });
};

/** Shopfront: lit glass, security bars, awning, painted sign board. */
function shopfront(
  k: Kit,
  atlas: SignAtlas,
  l: LocationDef,
  x: number,
  z: number,
  w: number,
  floors: number,
) {
  const [wall, accent, signBg, signFg] = l.palette;
  const depth = 5;
  const cz = z - depth / 2;
  const top = box(k, {
    x,
    z: cz,
    w,
    d: depth,
    h: FLOOR * floors,
    color: col(wall),
    record: true,
  });
  box(k, {
    x,
    z: cz,
    w: w + 0.12,
    d: depth + 0.12,
    h: 0.2,
    y: top,
    color: col(wall).multiplyScalar(0.7),
    windows: false,
  });
  // Ground floor: dark base, lit window, door.
  front(k.plain, x, z + 0.01, CURB, w, 1.35, col("#1f1c1a"));
  front(k.glow, x - 0.4, z + 0.03, CURB + 0.15, w * 0.62, 1.0, col("#ffdfb0"));
  for (let i = 0; i < 7; i++)
    front(
      k.plain,
      x - 0.4 - w * 0.31 + (i * w * 0.62) / 6,
      z + 0.05,
      CURB + 0.12,
      0.05,
      1.05,
      col("#2a2a2a"),
    );
  front(k.plain, x + w * 0.36, z + 0.03, CURB, 0.75, 1.15, col("#2b2622"));
  if (
    l.kind === "store" ||
    l.kind === "liquor" ||
    l.kind === "barber" ||
    l.kind === "pawn"
  )
    front(
      k.glow,
      x - w * 0.3,
      z + 0.06,
      CURB + 0.75,
      0.55,
      0.22,
      col(l.kind === "barber" ? "#4aa0ff" : "#ff3a4a"),
    );
  if (l.kind === "barber") {
    k.plain.geometry(
      CYL,
      placed(x + w / 2 - 0.2, CURB + 0.9, z + 0.2, 0.09, 1.1, 0.09),
      col("#e8e8e8"),
    );
    k.glow.geometry(
      CYL,
      placed(x + w / 2 - 0.2, CURB + 0.9, z + 0.2, 0.1, 0.5, 0.1),
      col("#d83a3a"),
    );
  }
  awning(
    k,
    x,
    z,
    w * 0.96,
    CURB + 1.45,
    accent,
    l.zone === "rio" || l.kind === "store",
  );
  if (l.sign) {
    const uv = atlas.sign(l.sign, signBg, signFg);
    const sw = Math.min(w * 0.95, 6.5);
    front(k.sign, x, z + 0.06, CURB + 1.75, sw, sw / 4, col("#ffffff"), uv);
  }
  return top;
}

function placeDims(b: BlockDef) {
  return {
    W: b.maxX - b.minX,
    D: b.maxZ - b.minZ,
    cx: (b.minX + b.maxX) / 2,
    cz: (b.minZ + b.maxZ) / 2,
  };
}

/**
 * Build a location on its block. Returns the area it occupies so the rest of
 * the block can be filled with ordinary district buildings.
 */
export function buildLocation(
  k: Kit,
  atlas: SignAtlas,
  l: LocationDef,
  b: BlockDef,
  extras: { trainZ: number; scene: (o: THREE.Object3D) => void },
): Rect {
  const { W, D, cx, cz } = placeDims(b);
  const [lx] = locationPosition(l);
  const [wall, accent] = l.palette;
  const r = k.r;
  const full: Rect = { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
  const southEdge = b.maxZ - 0.4;
  switch (l.archetype) {
    case "storefront": {
      const w = Math.min(W * 0.62, 7.5);
      const x = THREE.MathUtils.clamp(
        lx,
        b.minX + w / 2 + 0.3,
        b.maxX - w / 2 - 0.3,
      );
      const floors =
        l.floors ??
        (l.zone === "downtown"
          ? 6
          : l.zone === "nawf"
            ? 5
            : l.zone === "rio"
              ? 2
              : 3);
      shopfront(k, atlas, l, x, southEdge, w, floors);
      if (l.zone === "rio") palm(k, x + w / 2 + 0.8, southEdge + 1.2);
      else if (l.zone !== "downtown")
        tree(k, x - w / 2 - 0.7, southEdge + 1.1, 0.8, l.zone === "south");
      // Crates and a bench out front: the block-life props from the references.
      for (let i = 0; i < 3; i++)
        box(k, {
          x: x - w * 0.42 + i * 0.42,
          z: southEdge + 0.45,
          w: 0.36,
          d: 0.36,
          h: 0.3 + (i % 2) * 0.3,
          color: col(i % 2 ? accent : "#2a2a2a"),
          windows: false,
        });
      return {
        minX: x - w / 2 - 0.3,
        maxX: x + w / 2 + 0.3,
        minZ: southEdge - 5.4,
        maxZ: b.maxZ,
      };
    }
    case "garage": {
      const w = Math.min(W * 0.7, 8);
      const x = THREE.MathUtils.clamp(
        lx,
        b.minX + w / 2 + 0.3,
        b.maxX - w / 2 - 0.3,
      );
      const z = southEdge - 3;
      box(k, {
        x,
        z,
        w,
        d: 6,
        h: 2.8,
        color: col(wall),
        windows: false,
        record: true,
      });
      for (const i of [-1, 1]) {
        front(
          k.plain,
          x + i * w * 0.22,
          southEdge + 0.01,
          CURB,
          w * 0.36,
          1.9,
          col("#2c2a28"),
        );
        front(
          k.glow,
          x + i * w * 0.22,
          southEdge + 0.02,
          CURB + 0.05,
          w * 0.32,
          1.5,
          col("#ffe7c0"),
        );
      }
      if (l.sign)
        front(
          k.sign,
          x,
          southEdge + 0.03,
          CURB + 2.05,
          w * 0.85,
          w * 0.2,
          col("#fff"),
          atlas.sign(l.sign, l.palette[2], l.palette[3]),
        );
      for (let i = 0; i < 4; i++)
        k.plain.geometry(
          CYL,
          placed(
            x + w / 2 + 0.5,
            CURB + 0.15 + i * 0.24,
            southEdge - 0.6,
            0.35,
            0.22,
            0.35,
          ),
          col("#1a1a1a"),
        );
      const lowrider = l.zone === "rio";
      carBody(
        k,
        x - 1.6,
        southEdge + 1.5,
        0,
        lowrider ? "#b8902a" : "#3a3f46",
        lowrider,
      );
      carBody(
        k,
        x + 1.8,
        southEdge + 1.5,
        0,
        lowrider ? "#6a1f2b" : "#7a7f86",
        lowrider,
      );
      if (lowrider) palm(k, b.minX + 1, b.maxZ - 1);
      return {
        minX: x - w / 2 - 0.8,
        maxX: x + w / 2 + 0.8,
        minZ: z - 3.4,
        maxZ: b.maxZ,
      };
    }
    case "towers": {
      const brick = col(wall);
      const spots: [number, number, number][] = [
        [-0.28, -0.16, 0],
        [0.28, -0.16, 0],
        [0, 0.12, Math.PI / 2],
      ];
      for (const [fx, fz, rot] of spots) {
        const tx = cx + W * fx,
          tz = cz + D * fz;
        const top = box(k, {
          x: tx,
          z: tz,
          w: W * 0.26,
          d: D * 0.2,
          h: FLOOR * 20,
          rot,
          color: brick,
          record: true,
        });
        box(k, {
          x: tx,
          z: tz,
          w: W * 0.27,
          d: D * 0.21,
          h: 0.3,
          y: top,
          rot,
          color: col("#4c2f27"),
          windows: false,
        });
        for (let f = 2; f < 20; f += 3)
          box(k, {
            x: tx,
            z: tz,
            w: W * 0.272,
            d: D * 0.212,
            h: 0.08,
            y: CURB + f * FLOOR,
            rot,
            color: col("#b9aa98"),
            windows: false,
          });
      }
      // Painted name high on the front tower.
      if (l.sign)
        front(
          k.sign,
          cx + W * 0.28,
          cz - D * 0.16 + D * 0.1 + 0.02,
          CURB + FLOOR * 15,
          W * 0.24,
          W * 0.06,
          col("#fff"),
          atlas.sign(l.sign, wall, "#efe6d6"),
        );
      // Courtyard: benches, fence, bare trees.
      fence(k, b.minX + 0.6, b.maxZ - 0.5, b.maxX - 0.6, b.maxZ - 0.5);
      for (let i = 0; i < 3; i++)
        box(k, {
          x: cx - 2.5 + i * 2.5,
          z: b.maxZ - 2,
          w: 1.4,
          d: 0.4,
          h: 0.4,
          color: col("#7a7066"),
          windows: false,
        });
      tree(k, cx - W * 0.32, b.maxZ - 2.4, 1, true);
      tree(k, cx + W * 0.34, b.maxZ - 2.2, 1, true);
      return full;
    }
    case "projects": {
      for (const fx of [-0.25, 0.25]) {
        const top = box(k, {
          x: cx + W * fx,
          z: cz - D * 0.05,
          w: W * 0.36,
          d: D * 0.32,
          h: FLOOR * 12,
          color: col(wall),
          record: true,
        });
        box(k, {
          x: cx + W * fx,
          z: cz - D * 0.05,
          w: W * 0.37,
          d: D * 0.33,
          h: 0.25,
          y: top,
          color: col("#4c2f27"),
          windows: false,
        });
        // Water tank on the roof.
        k.plain.geometry(
          CYL,
          placed(cx + W * fx, top + 1, cz, 0.55, 1.3, 0.55),
          col("#5a4636"),
        );
        k.plain.geometry(
          CONE,
          placed(cx + W * fx, top + 1.9, cz, 0.6, 0.6, 0.6),
          col("#3c2f27"),
        );
      }
      fence(k, b.minX + 0.6, b.maxZ - 0.5, b.maxX - 0.6, b.maxZ - 0.5);
      tree(k, cx, b.maxZ - 2, 1.1);
      return full;
    }
    case "rowhouses": {
      const n = Math.max(4, Math.floor(W / 2.4));
      const w = W / n;
      for (const [edge, rot] of [
        [b.maxZ - 2.2, 0],
        [b.minZ + 2.2, Math.PI],
      ] as const)
        for (let i = 0; i < n; i++) {
          const x = b.minX + w * (i + 0.5);
          const boarded = r() < 0.25;
          const top = box(k, {
            x,
            z: edge,
            w: w - 0.06,
            d: 4,
            h: FLOOR * 3,
            rot,
            color: col(
              pick(r, ["#7c4434", "#8c5442", "#6a3c32"]),
            ).multiplyScalar(boarded ? 0.7 : 1),
            windows: !boarded,
            record: true,
          });
          box(k, {
            x,
            z: edge,
            w: w,
            d: 4.1,
            h: 0.18,
            y: top,
            rot,
            color: col("#3a2a24"),
            windows: false,
          });
          // Stoop.
          const sz = edge + (rot ? -2.4 : 2.4);
          box(k, {
            x: x + w * 0.2,
            z: sz,
            w: 0.8,
            d: 0.8,
            h: 0.45,
            color: col("#8a8580"),
            windows: false,
          });
        }
      return full;
    }
    case "lot": {
      box(k, {
        x: cx,
        z: cz,
        w: W - 0.4,
        d: D - 0.4,
        h: 0.05,
        color: col("#4f4a3a"),
        windows: false,
      });
      for (let i = 0; i < 14; i++)
        k.plain.geometry(
          BLOB,
          placed(
            b.minX + r() * W,
            CURB,
            b.minZ + r() * D,
            0.4 + r() * 0.4,
            0.25,
            0.4 + r() * 0.4,
          ),
          col(pick(r, ["#5c6b3a", "#6b6a3a", "#4a5a30"])),
        );
      fence(k, b.minX + 0.4, b.maxZ - 0.4, b.maxX - 0.4, b.maxZ - 0.4, 1.6);
      fence(k, b.minX + 0.4, b.minZ + 0.4, b.minX + 0.4, b.maxZ - 0.4, 1.6);
      // Burnt-out car and a tagged wall: the references' "The Lot".
      carBody(k, cx + 1, cz + 1, 0.5, "#4a3a32");
      box(k, {
        x: cx - W * 0.2,
        z: b.minZ + 1,
        w: W * 0.5,
        d: 0.5,
        h: 2.2,
        color: col("#8a8580"),
        windows: false,
        record: true,
      });
      box(k, {
        x: cx + W * 0.3,
        z: cz - D * 0.2,
        w: 3,
        d: 3,
        h: FLOOR * 2,
        color: col("#6a5a4a").multiplyScalar(0.8),
        windows: false,
        record: true,
      });
      return full;
    }
    case "court": {
      box(k, {
        x: cx,
        z: cz,
        w: W * 0.72,
        d: D * 0.56,
        h: 0.05,
        color: col(l.zone === "nawf" ? "#7a3a3a" : "#4d6b5a"),
        windows: false,
      });
      box(k, {
        x: cx,
        z: cz,
        w: W * 0.66,
        d: 0.06,
        h: 0.06,
        y: CURB + 0.05,
        color: col("#e8e4dc"),
        windows: false,
      });
      for (const s of [-1, 1]) {
        k.plain.geometry(
          CYL,
          placed(cx + s * W * 0.32, CURB + 1.4, cz, 0.08, 2.8, 0.08),
          col("#888"),
        );
        box(k, {
          x: cx + s * W * 0.3,
          z: cz,
          w: 0.08,
          d: 0.9,
          h: 0.6,
          y: CURB + 2.6,
          color: col("#e8e4dc"),
          windows: false,
        });
      }
      for (const s of [-1, 1])
        fence(
          k,
          b.minX + 0.6,
          cz + s * D * 0.31,
          b.maxX - 0.6,
          cz + s * D * 0.31,
          2.2,
        );
      box(k, {
        x: cx - W * 0.2,
        z: b.maxZ - 1,
        w: 2,
        d: 0.45,
        h: 0.45,
        color: col(accent),
        windows: false,
      });
      tree(k, b.minX + 1.3, b.maxZ - 1.3, 1.1);
      tree(k, b.maxX - 1.3, b.minZ + 1.3, 1.2);
      return full;
    }
    case "church": {
      const top = box(k, {
        x: cx,
        z: cz,
        w: W * 0.4,
        d: D * 0.6,
        h: 3.4,
        color: col(wall),
        windows: false,
        record: true,
      });
      gable(k, cx, cz, W * 0.4, D * 0.6, top, 2.2, Math.PI / 2, col("#4a3a32"));
      const tower = box(k, {
        x: cx,
        z: cz + D * 0.3,
        w: 1.8,
        d: 1.8,
        h: 6,
        color: col(wall),
        windows: false,
      });
      k.plain.geometry(
        CONE,
        placed(cx, tower + 1.2, cz + D * 0.3, 1.3, 2.4, 1.3, Math.PI / 4),
        col("#4a3a32"),
      );
      box(k, {
        x: cx,
        z: cz + D * 0.3,
        w: 0.12,
        d: 0.12,
        h: 1,
        y: tower + 2.4,
        color: col("#e8e2d0"),
        windows: false,
      });
      front(
        k.glow,
        cx,
        cz + D * 0.3 + 0.92,
        CURB + 2.6,
        0.6,
        1.1,
        col("#ffb24a"),
      );
      fence(k, b.minX + 0.6, b.maxZ - 0.5, b.maxX - 0.6, b.maxZ - 0.5, 0.9);
      return {
        minX: cx - W * 0.25,
        maxX: cx + W * 0.25,
        minZ: b.minZ,
        maxZ: b.maxZ,
      };
    }
    case "mission": {
      const top = box(k, {
        x: cx,
        z: cz,
        w: W * 0.6,
        d: D * 0.4,
        h: 3.2,
        color: col(wall),
        windows: false,
        record: true,
      });
      gable(k, cx, cz, W * 0.6, D * 0.4, top, 1.2, 0, col("#a8532e"));
      const tower = box(k, {
        x: cx - W * 0.26,
        z: cz + D * 0.12,
        w: 2.2,
        d: 2.2,
        h: 7.2,
        color: col(wall),
        windows: false,
      });
      k.plain.geometry(
        DOME,
        placed(cx - W * 0.26, tower, cz + D * 0.12, 1.1, 1.3, 1.1),
        col("#a8532e"),
      );
      front(
        k.glow,
        cx - W * 0.26,
        cz + D * 0.12 + 1.12,
        tower - 1.6,
        0.8,
        1,
        col("#ffd27a"),
      );
      palm(k, b.minX + 1.2, b.maxZ - 1.2, 1.3);
      palm(k, b.maxX - 1.2, b.maxZ - 1.2, 1.2);
      return full;
    }
    case "cityhall": {
      const lime = col(wall);
      box(k, {
        x: cx,
        z: cz,
        w: W * 0.8,
        d: D * 0.6,
        h: 3.6,
        color: lime,
        record: true,
      });
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
        z: cz + D * 0.38,
        w: W * 0.5,
        d: 1.4,
        h: 0.5,
        y: 0,
        color: lime,
        windows: false,
      });
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
        col(accent),
      );
      k.glow.geometry(
        BLOB,
        placed(cx, CURB + 8.8, cz, 0.18, 0.4, 0.18),
        col("#ffe6b0"),
      );
      if (l.sign)
        front(
          k.sign,
          cx,
          cz + D * 0.3 + 0.03,
          CURB + 3.65,
          W * 0.42,
          W * 0.105,
          col("#fff"),
          atlas.sign(l.sign, l.palette[2], l.palette[3]),
        );
      for (const s of [-1, 1]) {
        k.plain.geometry(
          CYL,
          placed(cx + s * W * 0.32, CURB + 2.5, b.maxZ - 0.8, 0.05, 5, 0.05),
          col("#ccc"),
        );
        front(
          k.plain,
          cx + s * W * 0.32 + 0.45,
          b.maxZ - 0.8,
          CURB + 4,
          0.8,
          0.5,
          col(s > 0 ? "#2a4f9a" : "#b8342e"),
        );
      }
      palm(k, b.minX + 1, b.maxZ - 1, 1.1);
      palm(k, b.maxX - 1, b.maxZ - 1, 1.1);
      return full;
    }
    case "precinct": {
      const top = box(k, {
        x: cx,
        z: cz,
        w: W * 0.72,
        d: D * 0.6,
        h: FLOOR * 5,
        color: col(wall),
        record: true,
      });
      box(k, {
        x: cx,
        z: cz,
        w: W * 0.74,
        d: D * 0.62,
        h: 0.25,
        y: top,
        color: col("#3a434c"),
        windows: false,
      });
      if (l.sign)
        front(
          k.sign,
          cx,
          cz + D * 0.3 + 0.03,
          CURB + 1.5,
          W * 0.5,
          W * 0.125,
          col("#fff"),
          atlas.sign(l.sign, l.palette[2], l.palette[3]),
        );
      front(
        k.glow,
        cx,
        cz + D * 0.3 + 0.02,
        CURB + 0.1,
        2.2,
        1.1,
        col("#cfe0ff"),
      );
      k.glow.geometry(
        BLOB,
        placed(cx + 2, CURB + 1.4, cz + D * 0.32, 0.25, 0.25, 0.25),
        col("#4a7dff"),
      );
      for (let i = 0; i < 4; i++)
        carBody(
          k,
          cx - 4 + i * 2.4,
          b.maxZ - 1.2,
          Math.PI / 2,
          i % 2 ? "#1d2026" : "#e8e8e8",
        );
      return full;
    }
    case "docks": {
      for (let i = 0; i < 10; i++) {
        const x = b.minX + 1 + r() * (W - 2),
          z = b.minZ + 1 + r() * (D - 2);
        box(k, {
          x,
          z,
          w: 1.2,
          d: 2.8,
          h: 0.9 + Math.floor(r() * 3) * 0.9,
          y: 0,
          color: col(
            pick(r, ["#a6452f", "#2f5f7f", "#c08b32", "#5c6f4a", "#7a3a5a"]),
          ),
          windows: false,
        });
      }
      for (const s of [-1, 1]) {
        const x = cx + s * W * 0.25;
        box(k, {
          x,
          z: cz,
          w: 0.5,
          d: 0.5,
          h: 10,
          y: 0,
          color: col(accent),
          windows: false,
        });
        box(k, {
          x: x + 2.8,
          z: cz,
          w: 8,
          d: 0.5,
          h: 0.5,
          y: 10,
          color: col(accent),
          windows: false,
        });
        box(k, {
          x: x - 1.5,
          z: cz,
          w: 2,
          d: 1.2,
          h: 1,
          y: 9.2,
          color: col("#3a3a3a"),
          windows: false,
        });
      }
      if (l.sign)
        front(
          k.sign,
          cx,
          b.maxZ - 0.2,
          CURB + 2.2,
          6,
          1.5,
          col("#fff"),
          atlas.sign(l.sign, l.palette[2], l.palette[3]),
        );
      return full;
    }
    case "warehouse": {
      const z = cz;
      const top = box(k, {
        x: cx,
        z,
        w: W * 0.82,
        d: D * 0.62,
        h: 3,
        color: col(wall),
        windows: false,
        record: true,
      });
      for (let i = 0; i < 4; i++)
        box(k, {
          x: cx - W * 0.3 + i * W * 0.2,
          z,
          w: W * 0.16,
          d: D * 0.6,
          h: 0.7,
          y: top,
          color: col("#6f6c66"),
          windows: false,
        });
      for (let i = 0; i < 3; i++)
        front(
          k.plain,
          cx - W * 0.25 + i * W * 0.25,
          z + D * 0.31 + 0.01,
          CURB,
          1.6,
          1.8,
          col("#3d4248"),
        );
      if (l.sign)
        front(
          k.sign,
          cx,
          z + D * 0.31 + 0.02,
          CURB + 2.15,
          W * 0.5,
          W * 0.125,
          col("#fff"),
          atlas.sign(l.sign, l.palette[2], l.palette[3]),
        );
      for (let i = 0; i < 2; i++)
        carBody(k, cx - 2 + i * 2.6, b.maxZ - 1.1, 0, "#e9e2d0");
      return full;
    }
    case "station": {
      const z = extras.trainZ;
      box(k, {
        x: cx,
        z,
        w: W * 0.6,
        d: 4.2,
        h: 2.2,
        y: 5.2,
        color: col(wall),
        windows: true,
      });
      for (const s of [-1, 1])
        box(k, {
          x: cx + s * W * 0.25,
          z: z + 2.6,
          w: 1.2,
          d: 1.2,
          h: 5.2,
          color: col("#4a4f55"),
          windows: false,
        });
      front(k.glow, cx, z + 2.11, 5.5, W * 0.5, 0.6, col("#ffe0a0"));
      if (l.sign)
        front(
          k.sign,
          cx,
          z + 2.13,
          6.4,
          4,
          1,
          col("#fff"),
          atlas.sign(l.sign, l.palette[2], l.palette[3]),
        );
      return {
        minX: cx - W * 0.35,
        maxX: cx + W * 0.35,
        minZ: z - 2.5,
        maxZ: z + 3.4,
      };
    }
    case "mural": {
      const w = W * 0.7;
      box(k, {
        x: cx,
        z: southEdge - 2.5,
        w,
        d: 5,
        h: FLOOR * 3,
        color: col(wall),
        record: false,
      });
      front(
        k.sign,
        cx,
        southEdge + 0.02,
        CURB + 0.1,
        w * 0.92,
        FLOOR * 2.6,
        col("#fff"),
        atlas.wings(),
      );
      palm(k, b.minX + 1.2, b.maxZ - 1.2);
      carBody(k, cx + 1, southEdge + 1.4, 0, "#b8902a", true);
      return {
        minX: cx - w / 2 - 0.3,
        maxX: cx + w / 2 + 0.3,
        minZ: southEdge - 5.4,
        maxZ: b.maxZ,
      };
    }
    case "memorial": {
      const w = W * 0.66;
      box(k, {
        x: cx,
        z: southEdge - 2.6,
        w,
        d: 5.2,
        h: FLOOR * 5,
        color: col(wall),
        record: false,
      });
      front(
        k.sign,
        cx,
        southEdge + 0.02,
        CURB + 0.3,
        w * 0.8,
        w * 0.2,
        col("#fff"),
        atlas.memorial(),
      );
      for (let i = 0; i < 12; i++)
        k.glow.geometry(
          BLOB,
          placed(
            cx - w * 0.3 + r() * w * 0.6,
            CURB + 0.12,
            southEdge + 0.3 + r() * 0.5,
            0.07,
            0.13,
            0.07,
          ),
          col("#ffb35a"),
        );
      for (let i = 0; i < 8; i++)
        k.plain.geometry(
          BLOB,
          placed(
            cx - w * 0.3 + r() * w * 0.6,
            CURB + 0.15,
            southEdge + 0.5 + r() * 0.4,
            0.17,
            0.12,
            0.17,
          ),
          col(pick(r, ["#e8e2d8", "#c23a4a", "#e8b84a"])),
        );
      return {
        minX: cx - w / 2 - 0.3,
        maxX: cx + w / 2 + 0.3,
        minZ: southEdge - 5.6,
        maxZ: b.maxZ,
      };
    }
    case "hall": {
      const w = W * 0.72;
      const top = box(k, {
        x: cx,
        z: southEdge - 3.2,
        w,
        d: 6.4,
        h: FLOOR * 3,
        color: col(wall),
        record: true,
      });
      box(k, {
        x: cx,
        z: southEdge - 3.2,
        w: w + 0.2,
        d: 6.6,
        h: 0.25,
        y: top,
        color: col(wall).multiplyScalar(0.7),
        windows: false,
      });
      front(k.glow, cx, southEdge + 0.02, CURB + 0.1, 2.4, 1.3, col("#ffe2b0"));
      if (l.sign)
        front(
          k.sign,
          cx,
          southEdge + 0.04,
          CURB + 1.7,
          w * 0.8,
          w * 0.2,
          col("#fff"),
          atlas.sign(l.sign, l.palette[2], l.palette[3]),
        );
      return {
        minX: cx - w / 2 - 0.3,
        maxX: cx + w / 2 + 0.3,
        minZ: southEdge - 6.8,
        maxZ: b.maxZ,
      };
    }
    case "market": {
      for (let i = 0; i < 4; i++) {
        const x = b.minX + 2 + i * ((W - 4) / 3),
          z = cz + (i % 2 ? 1.5 : -1.5);
        const canopy = pick(r, [accent, "#2a4f9a", "#c83d45", "#e3c23a"]);
        for (const [dx, dz] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ])
          box(k, {
            x: x + dx * 1.1,
            z: z + dz * 1.1,
            w: 0.08,
            d: 0.08,
            h: 1.9,
            color: col("#3a3a3a"),
            windows: false,
          });
        k.plain.geometry(
          CONE,
          placed(x, CURB + 2.3, z, 1.75, 0.7, 1.75, Math.PI / 4),
          col(canopy),
        );
        box(k, {
          x,
          z,
          w: 1.8,
          d: 0.8,
          h: 0.8,
          color: col("#6a5040"),
          windows: false,
        });
        k.glow.geometry(
          BLOB,
          placed(x, CURB + 1.8, z, 0.12, 0.12, 0.12),
          col("#ffe0a0"),
        );
      }
      return full;
    }
    case "courtyard": {
      const u = 1.6;
      for (const [x, z, w, d] of [
        [cx, b.minZ + 2.4, W - 1, 4],
        [b.minX + 2.2, cz + 1, 3.6, D - 6],
        [b.maxX - 2.2, cz + 1, 3.6, D - 6],
      ] as const) {
        const top = box(k, {
          x,
          z,
          w,
          d,
          h: FLOOR * 2 + 0.2,
          color: col(wall),
          record: true,
        });
        box(k, {
          x,
          z,
          w: w + 0.1,
          d: d + 0.1,
          h: 0.12,
          y: top,
          color: col("#a8532e"),
          windows: false,
        });
        box(k, {
          x,
          z: z + d / 2 + 0.5,
          w: w * 0.8,
          d: 0.9,
          h: 0.1,
          y: CURB + FLOOR + 0.1,
          color: col("#5a4a3a"),
          windows: false,
        });
      }
      // Shrine and laundry lines.
      box(k, {
        x: cx,
        z: cz + 1,
        w: 0.8,
        d: 0.5,
        h: 1.2,
        color: col("#e8e2d0"),
        windows: false,
      });
      k.glow.geometry(
        BLOB,
        placed(cx, CURB + 0.9, cz + 1.3, 0.12, 0.18, 0.12),
        col("#ffb35a"),
      );
      front(k.plain, cx - 1, cz - 1, CURB + 1.6, 1, 0.6, col("#f5f1e6"));
      front(k.plain, cx + 0.4, cz - 1, CURB + 1.6, 0.8, 0.55, col("#e9be39"));
      palm(k, cx + u * 1.5, cz + 2.5);
      return full;
    }
    case "house": {
      const boarded = l.kind === "street";
      for (const [x, z] of [
        [cx - W * 0.22, cz + D * 0.18],
        [cx + W * 0.22, cz + D * 0.18],
        [cx - W * 0.22, cz - D * 0.22],
        [cx + W * 0.22, cz - D * 0.22],
      ] as const) {
        const main = Math.abs(x - lx) < W * 0.25 && z > cz;
        const wallC = col(
          pick(r, DISTRICT_STYLE.reservoir.walls),
        ).multiplyScalar(boarded && main ? 0.62 : 1);
        const top = box(k, {
          x,
          z,
          w: 3.6,
          d: 3.4,
          h: FLOOR * 2,
          color: wallC,
          windows: !(boarded && main),
          record: true,
        });
        gable(
          k,
          x,
          z,
          3.6,
          3.4,
          top,
          1.3,
          Math.PI / 2,
          col(pick(r, ["#3c3633", "#4a3e3a", "#2f3236"])),
        );
        // Porch.
        box(k, {
          x,
          z: z + 2.1,
          w: 3.2,
          d: 0.9,
          h: 0.1,
          y: CURB + 1.2,
          color: col("#4a3e3a"),
          windows: false,
        });
        for (const s of [-1, 1])
          box(k, {
            x: x + s * 1.4,
            z: z + 2.5,
            w: 0.1,
            d: 0.1,
            h: 1.2,
            color: col("#d8d0c0"),
            windows: false,
          });
        if (boarded && main)
          for (let i = 0; i < 3; i++)
            front(
              k.plain,
              x - 1 + i,
              z + 1.72,
              CURB + 0.6,
              0.6,
              0.7,
              col("#a88a5a"),
            );
      }
      if (boarded) carBody(k, cx + W * 0.3, b.maxZ - 0.9, 0.2, "#5a4a3a");
      tree(k, b.minX + 1, b.maxZ - 1, 1.2);
      return full;
    }
    case "watertower": {
      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        box(k, {
          x: cx + dx * 1.3,
          z: cz + dz * 1.3,
          w: 0.25,
          d: 0.25,
          h: 9,
          color: col("#4a4a44"),
          windows: false,
        });
      k.plain.geometry(CYL, placed(cx, CURB + 11, cz, 2.4, 4, 2.4), col(wall));
      k.plain.geometry(
        CONE,
        placed(cx, CURB + 14, cz, 2.6, 2, 2.6),
        col("#3a3a36"),
      );
      front(
        k.sign,
        cx,
        cz + 2.42,
        CURB + 10.2,
        3.6,
        0.9,
        col("#fff"),
        atlas.tag("BB", "#3678c6", true),
      );
      tree(k, b.minX + 1.5, b.maxZ - 1.5, 1.3);
      tree(k, b.maxX - 1.5, b.maxZ - 1.5, 1.2);
      return full;
    }
  }
}

// ---------------------------------------------------------------------------
// Ordinary blocks: perimeter rows in each district's vocabulary.
// ---------------------------------------------------------------------------
export function fillBlock(
  k: Kit,
  zone: ZoneId,
  b: BlockDef,
  exclude: Rect | null,
  avoidZ: number,
) {
  const r = k.r,
    style = DISTRICT_STYLE[zone];
  const W = b.maxX - b.minX,
    D = b.maxZ - b.minZ;
  const free = (x: number, z: number, w: number, d: number) =>
    !exclude ||
    !overlaps(
      { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 },
      exclude,
    );
  const blocked = (z: number, depth: number) =>
    !Number.isNaN(avoidZ) && Math.abs(z - avoidZ) < depth / 2 + 1.6;
  if (zone === "downtown") {
    for (const fx of [0.25, 0.75])
      for (const fz of [0.25, 0.75]) {
        const x = b.minX + W * fx,
          z = b.minZ + D * fz,
          w = W * 0.42,
          d = D * 0.42;
        if (r() < 0.1 || !free(x, z, w, d)) continue;
        const wall = col(pick(r, style.walls));
        const floors = 6 + Math.floor(Math.pow(r(), 1.5) * 30);
        const podium = box(k, {
          x,
          z,
          w,
          d,
          h: FLOOR * Math.min(4, floors),
          color: wall,
          record: true,
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
    if (r() < style.trees) palm(k, b.minX + 0.8, b.maxZ - 0.8, 1.2);
    return;
  }
  const lotDepth = zone === "nawf" ? 4.2 : zone === "south" ? 4 : 3.6;
  const lotWidth = zone === "reservoir" ? 3.4 : zone === "rio" ? 3.3 : 3.2;
  const rows: { x: number; z: number; rot: number; w: number }[] = [];
  const along = (len: number) => Math.max(1, Math.floor(len / lotWidth));
  const nxLots = along(W),
    lw = W / nxLots;
  for (let i = 0; i < nxLots; i++) {
    const x = b.minX + lw * (i + 0.5);
    rows.push({ x, z: b.minZ + lotDepth / 2 + 0.3, rot: Math.PI, w: lw });
    rows.push({ x, z: b.maxZ - lotDepth / 2 - 0.3, rot: 0, w: lw });
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
      rows.push({ x: b.maxX - lotDepth / 2 - 0.3, z, rot: Math.PI / 2, w: lz });
    }
  }
  if (
    zone === "south" &&
    r() < 0.3 &&
    free((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, W * 0.32, D * 0.32)
  ) {
    box(k, {
      x: (b.minX + b.maxX) / 2,
      z: (b.minZ + b.maxZ) / 2,
      w: W * 0.3,
      d: D * 0.3,
      h: FLOOR * (9 + Math.floor(r() * 5)),
      color: col(pick(r, style.walls)),
      record: true,
    });
  } else if (r() < style.trees) {
    const x = (b.minX + b.maxX) / 2,
      z = (b.minZ + b.maxZ) / 2;
    if (free(x, z, 2, 2))
      (zone === "rio"
        ? palm
        : (kk: Kit, xx: number, zz: number) =>
            tree(kk, xx, zz, 1.1, zone === "south"))(k, x, z);
  }
  for (const lot of rows) {
    const w = lot.w - 0.25;
    if (blocked(lot.z, lotDepth) || !free(lot.x, lot.z, w, lotDepth)) continue;
    const wall = col(pick(r, style.walls));
    if (zone === "reservoir") {
      if (r() < 0.28) {
        box(k, {
          x: lot.x,
          z: lot.z,
          w,
          d: lotDepth,
          h: 0.04,
          rot: lot.rot,
          color: col(r() < 0.5 ? "#5b5a3a" : "#6a5a44"),
          windows: false,
        });
        if (r() < 0.5) tree(k, lot.x, lot.z, 0.6);
        continue;
      }
      const boarded = r() < 0.26;
      const top = box(k, {
        x: lot.x,
        z: lot.z,
        w: w * 0.86,
        d: lotDepth * 0.8,
        h: FLOOR * (r() < 0.6 ? 2 : 1.5),
        rot: lot.rot,
        color: boarded ? wall.clone().multiplyScalar(0.65) : wall,
        windows: !boarded,
        record: true,
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
      const top = box(k, {
        x: lot.x,
        z: lot.z,
        w,
        d: lotDepth,
        h: FLOOR * floors + 0.2,
        rot: lot.rot,
        color: wall,
        record: true,
      });
      if (r() < 0.45)
        box(k, {
          x: lot.x,
          z: lot.z,
          w: w + 0.12,
          d: lotDepth + 0.12,
          h: 0.14,
          y: top,
          rot: lot.rot,
          color: col("#a8532e"),
          windows: false,
        });
      continue;
    }
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
      record: true,
    });
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
    });
    if (zone === "nawf") {
      // Fire escapes on the street face.
      const s = Math.sin(lot.rot),
        c = Math.cos(lot.rot);
      const fx = lot.x + s * (lotDepth / 2 + 0.25),
        fz = lot.z + c * (lotDepth / 2 + 0.25);
      if (r() < 0.6)
        for (let f = 1; f < floors; f++)
          box(k, {
            x: fx,
            z: fz,
            w: w * 0.5,
            d: 0.5,
            h: 0.06,
            y: CURB + f * FLOOR,
            rot: lot.rot,
            color: col("#2a2a2a"),
            windows: false,
          });
      if (r() < 0.35) {
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
}

/** Waterfront blocks: promenade, palms and benches. */
export function waterfront(
  k: Kit,
  zone: ZoneId,
  b: BlockDef,
  nearRiver: (x: number, z: number, pad: number) => boolean,
) {
  const r = k.r;
  for (let i = 0; i < 4; i++) {
    const x = b.minX + r() * (b.maxX - b.minX),
      z = b.minZ + r() * (b.maxZ - b.minZ);
    if (nearRiver(x, z, 1.5)) continue;
    if (zone === "rio" || zone === "downtown") palm(k, x, z);
    else tree(k, x, z, 1.1, zone === "south");
  }
}
