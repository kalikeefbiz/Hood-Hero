import * as THREE from "three";
import type { Appearance } from "./presence";

// ---------------------------------------------------------------------------
// The player's figure on the board, assembled from parts so a character
// creator can drive it. When `appearance.model` is set, a GLB from the
// creator (or Meshy) replaces the procedural figure; it is fitted to the same
// height so the rest of the board doesn't care which one is used.
// ---------------------------------------------------------------------------

export const FIGURE_HEIGHT = 1.9;

const mat = (color: string, rough = 0.75) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough });

export function buildFigure(a: Appearance): THREE.Group {
  const g = new THREE.Group();
  const width = a.build === "slim" ? 0.86 : a.build === "broad" ? 1.18 : 1;
  const skin = mat(a.skin, 0.6),
    top = mat(a.topColor),
    bottom = mat(a.bottomColor),
    shoes = mat(a.shoeColor, 0.5),
    hair = mat(a.hairColor, 0.9);
  const part = (
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z = 0,
  ) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  // Legs and shoes.
  for (const s of [-1, 1]) {
    part(
      new THREE.CapsuleGeometry(0.11 * width, 0.62, 3, 8),
      bottom,
      s * 0.13 * width,
      0.5,
    );
    part(
      new THREE.BoxGeometry(0.2, 0.12, 0.32),
      shoes,
      s * 0.13 * width,
      0.08,
      0.04,
    );
  }
  // Torso by top style.
  const torsoH = a.top === "jacket" ? 0.68 : 0.62;
  const torso = part(
    new THREE.CapsuleGeometry(0.24 * width, torsoH - 0.2, 4, 10),
    a.top === "tank" ? skin : top,
    0,
    1.16,
  );
  torso.scale.set(1, 1, 0.72);
  if (a.top === "tank")
    part(
      new THREE.CapsuleGeometry(0.235 * width, 0.36, 4, 10),
      top,
      0,
      1.1,
    ).scale.set(1.02, 1, 0.74);
  if (a.top === "hoodie")
    part(
      new THREE.TorusGeometry(0.16, 0.06, 6, 12, Math.PI),
      top,
      0,
      1.47,
      -0.08,
    ).rotation.set(0, 0, Math.PI);
  if (a.top === "jersey")
    part(new THREE.BoxGeometry(0.2, 0.18, 0.02), mat("#f5f1e6"), 0, 1.2, 0.17);
  if (a.top === "jacket")
    for (const s of [-1, 1])
      part(
        new THREE.BoxGeometry(0.02, 0.5, 0.02),
        mat("#1a1a1a"),
        s * 0.05,
        1.12,
        0.18,
      );
  // Arms.
  for (const s of [-1, 1]) {
    const arm = part(
      new THREE.CapsuleGeometry(0.075 * width, 0.5, 3, 8),
      a.top === "tank" || a.top === "tee" || a.top === "jersey" ? skin : top,
      s * (0.31 * width),
      1.1,
    );
    arm.rotation.z = s * 0.12;
    if (a.top === "tee" || a.top === "jersey")
      part(
        new THREE.CapsuleGeometry(0.085 * width, 0.14, 3, 8),
        top,
        s * 0.3 * width,
        1.3,
      ).rotation.z = s * 0.12;
  }
  // Neck, head.
  part(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8), skin, 0, 1.5);
  part(new THREE.SphereGeometry(0.17, 14, 10), skin, 0, 1.68);
  // Hair.
  switch (a.hair) {
    case "fade":
      part(
        new THREE.SphereGeometry(
          0.175,
          14,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2.4,
        ),
        hair,
        0,
        1.7,
      );
      break;
    case "waves":
      part(
        new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1),
        hair,
        0,
        1.69,
      );
      break;
    case "afro":
      part(new THREE.SphereGeometry(0.27, 14, 10), hair, 0, 1.79, -0.03);
      break;
    case "braids":
    case "locs": {
      part(
        new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        hair,
        0,
        1.7,
      );
      const n = a.hair === "locs" ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1) - 0.5) * Math.PI * 1.2 + Math.PI;
        const strand = part(
          new THREE.CapsuleGeometry(
            0.03,
            a.hair === "locs" ? 0.38 : 0.26,
            2,
            4,
          ),
          hair,
          Math.sin(t) * 0.16,
          a.hair === "locs" ? 1.5 : 1.56,
          Math.cos(t) * 0.16,
        );
        strand.rotation.x = Math.cos(t) * 0.25;
      }
      break;
    }
    case "cap": {
      part(
        new THREE.SphereGeometry(0.182, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        top,
        0,
        1.71,
      );
      part(
        new THREE.CylinderGeometry(
          0.15,
          0.15,
          0.02,
          14,
          1,
          false,
          -Math.PI / 2,
          Math.PI,
        ),
        top,
        0,
        1.72,
        0.12,
      );
      break;
    }
    case "bald":
      break;
  }
  if (a.chain)
    part(
      new THREE.TorusGeometry(0.13, 0.018, 6, 18),
      mat("#e3c23a", 0.25),
      0,
      1.36,
      0.1,
    ).rotation.x = Math.PI / 2.4;
  return g;
}

/** Load a GLB figure and fit it to the board's figure height. */
export async function loadFigureModel(url: string): Promise<THREE.Group> {
  const { GLTFLoader } =
    await import("three/examples/jsm/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = new THREE.Group();
  root.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const h = box.max.y - box.min.y || 1;
  gltf.scene.scale.setScalar(FIGURE_HEIGHT / h);
  gltf.scene.position.y = -box.min.y * (FIGURE_HEIGHT / h);
  root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return root;
}
