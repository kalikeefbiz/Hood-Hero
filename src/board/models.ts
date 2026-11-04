import * as THREE from "three";

/**
 * GLB assets that replace procedural pieces of the board. Every file lives under
 * public/ and is optional: until it loads (or if it fails), the procedural
 * version stays on screen, so a missing model never breaks the board.
 *
 * Generated with Meshy (image-to-3D, Smart Topology, ~2.5–5k triangles, one
 * KTX2 base-color map each: 1024px landmarks, 512px set pieces, 256px cars) —
 * see docs/STRATEGY_BOARD.md.
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

/*
 * Model textures are KTX2 (Basis ETC1S). The phone's GPU keeps them
 * compressed (ASTC/ETC2), about an eighth of the memory of a plain image.
 * The transcoder lives in public/basis/ and needs the renderer to pick the
 * format the device supports.
 */
let renderer: THREE.WebGLRenderer | null = null;
let ktx2: Promise<unknown> | null = null;
export function useModelRenderer(r: THREE.WebGLRenderer) {
  renderer = r;
}
function ktx2Loader() {
  if (!ktx2 && renderer) {
    const r = renderer;
    ktx2 = import("three/examples/jsm/loaders/KTX2Loader.js").then(
      ({ KTX2Loader }) =>
        new KTX2Loader()
          .setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
          .detectSupport(r),
    );
  }
  return ktx2;
}

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
    p = Promise.all([
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ktx2Loader(),
    ])
      .then(
        ([{ GLTFLoader }, { MeshoptDecoder }, ktx]) =>
          new Promise<ModelPiece | null>((resolve) => {
            // Geometry is meshopt-compressed and quantized (about half the
            // download); textures are KTX2.
            const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
            if (ktx)
              loader.setKTX2Loader(
                ktx as Parameters<typeof loader.setKTX2Loader>[0],
              );
            loader.load(
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
                const geometry = toFloat(mesh.geometry);
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
 * Quantized attributes (int16, normalized) cannot hold world-space values, so
 * copy every attribute to float before baking the node transform in.
 */
function toFloat(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  g.setIndex(src.index ? src.index.clone() : null);
  for (const [name, a] of Object.entries(src.attributes)) {
    const attr = a as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
    const n = attr.itemSize,
      out = new Float32Array(attr.count * n);
    for (let i = 0; i < attr.count; i++)
      for (let c = 0; c < n; c++) out[i * n + c] = attr.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(out, n));
  }
  return g;
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
