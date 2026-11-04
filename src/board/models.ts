import * as THREE from "three";

/**
 * GLB assets that replace procedural pieces of the board. Every file lives under
 * public/ and is optional: until it loads (or if it fails), the procedural
 * version stays on screen, so a missing model never breaks the board.
 *
 * Generated with Meshy (image-to-3D, Smart Topology, ~2.5–5k triangles, one
 * 512px WebP base-color map each) — see docs/STRATEGY_BOARD.md.
 */
export const MODEL_FILES = {
  southsideTowers: "assets/models/southside-towers.glb",
  elStation: "assets/models/el-station.glb",
  cornerBodega: "assets/models/corner-bodega.glb",
  lowrider: "assets/models/lowrider.glb",
  policeCruiser: "assets/models/police-cruiser.glb",
} as const;

/** One mesh + material, normalised for instancing (cars) or placement. */
export interface ModelPiece {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

const cache = new Map<string, Promise<ModelPiece | null>>();

/** Every geometry handed out here is shared; renderers must not dispose it. */
export const sharedModelGeometry = new WeakSet<THREE.BufferGeometry>();
export const sharedModelMaterial = new WeakSet<THREE.Material>();

/**
 * Load a single-mesh GLB, bake its node transform into the geometry, and
 * normalise it: centred on X/Z, resting on y = 0. `lite` swaps the PBR material
 * for Lambert to match the software-renderer look.
 */
export function loadModelPiece(
  path: string,
  lite: boolean,
): Promise<ModelPiece | null> {
  const key = `${path}|${lite}`;
  let p = cache.get(key);
  if (!p) {
    p = import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(
        ({ GLTFLoader }) =>
          new Promise<ModelPiece | null>((resolve) => {
            new GLTFLoader().load(
              `${import.meta.env.BASE_URL}${path}`,
              (gltf) => {
                let found: THREE.Mesh | null = null;
                gltf.scene.updateMatrixWorld(true);
                gltf.scene.traverse((o) => {
                  const m = o as THREE.Mesh;
                  if (!found && m.isMesh) found = m;
                });
                if (!found) return resolve(null);
                const mesh = found as THREE.Mesh;
                const geometry = mesh.geometry.clone();
                geometry.applyMatrix4(mesh.matrixWorld);
                geometry.computeBoundingBox();
                const bb = geometry.boundingBox!;
                geometry.translate(
                  -(bb.min.x + bb.max.x) / 2,
                  -bb.min.y,
                  -(bb.min.z + bb.max.z) / 2,
                );
                geometry.computeBoundingBox();
                sharedModelGeometry.add(geometry);
                const src = mesh.material as THREE.MeshStandardMaterial;
                const material = lite
                  ? new THREE.MeshLambertMaterial({ map: src.map })
                  : src;
                material.side = THREE.FrontSide;
                sharedModelMaterial.add(material);
                resolve({ geometry, material });
              },
              undefined,
              () => resolve(null),
            );
          }),
      )
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

/**
 * Scale a vehicle so its length (along X) matches the procedural car box,
 * returning a geometry dedicated to instancing.
 */
export function asVehicle(
  piece: ModelPiece,
  length: number,
  /**
   * Board cars drive along local +X. Meshy vehicles come out nose-first
   * along -X, so they are turned around by default.
   */
  flip = true,
): ModelPiece {
  const g = piece.geometry.clone();
  const size = g.boundingBox!.getSize(new THREE.Vector3());
  const s = length / (size.x || 1);
  g.scale(s, s, s);
  if (flip) g.rotateY(Math.PI);
  g.translate(0, 0.02, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  sharedModelGeometry.add(g);
  return { geometry: g, material: piece.material };
}
