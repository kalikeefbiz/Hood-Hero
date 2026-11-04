import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FIGURE_HEIGHT } from "./character";
import { boardGltfLoader } from "./models";

/**
 * Rigged character models for named characters on the board. A character
 * listed here replaces the generic capsule figure wherever they stand.
 *
 * Built with Meshy (image-to-image A-pose sheet → image-to-3D Smart Topology →
 * auto-rig). Each rig ships with Meshy's walk and run clips; there is no idle,
 * so a standing character holds the walk cycle's passing pose (feet together,
 * arms down). Future clips (cup, cigar, aiming…) go in `clips` by name.
 *
 * Main characters stand at their spot; they do not wander like crowd figures.
 */
export interface CharacterModel {
  model: string;
  clips: Record<string, string>;
}
export const CHARACTER_MODELS: Record<string, CharacterModel> = {
  mega: {
    model: "assets/models/characters/mega.glb",
    clips: {
      walk: "assets/models/characters/mega-walk.glb",
      run: "assets/models/characters/mega-run.glb",
    },
  },
};

export type Motion = "stand" | string;

interface Template {
  scene: THREE.Group;
  clips: Record<string, THREE.AnimationClip>;
  standTime: number;
}
const templates = new Map<string, Promise<Template | null>>();

/** A posable instance of a character: put `root` in the scene, call `update`. */
export interface CharacterInstance {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  play(motion: Motion): void;
  update(dt: number): void;
}

/** Find the walk cycle's passing pose: the moment the feet are closest. */
function passingTime(scene: THREE.Object3D, clip: THREE.AnimationClip) {
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip).play();
  const l = scene.getObjectByName("LeftFoot"),
    r = scene.getObjectByName("RightFoot");
  if (!l || !r) return 0;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3();
  let best = 0,
    bestD = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = (clip.duration * i) / 40;
    mixer.setTime(t);
    scene.updateMatrixWorld(true);
    const d = l.getWorldPosition(a).distanceTo(r.getWorldPosition(b));
    if (d < bestD) [bestD, best] = [d, t];
  }
  action.stop();
  mixer.uncacheRoot(scene);
  return best;
}

function loadTemplate(id: string): Promise<Template | null> {
  const def = CHARACTER_MODELS[id];
  if (!def) return Promise.resolve(null);
  let p = templates.get(id);
  if (!p) {
    const base = import.meta.env.BASE_URL;
    p = boardGltfLoader()
      .then(async (loader) => {
        const gltf = await loader.loadAsync(`${base}${def.model}`);
        const clips: Record<string, THREE.AnimationClip> = {};
        await Promise.all(
          Object.entries(def.clips).map(async ([name, path]) => {
            const c = await loader.loadAsync(`${base}${path}`);
            if (c.animations[0]) clips[name] = c.animations[0];
          }),
        );
        const scene = gltf.scene;
        const box = new THREE.Box3().setFromObject(scene);
        const h = box.max.y - box.min.y || 1;
        scene.scale.setScalar(FIGURE_HEIGHT / h);
        scene.position.y = -box.min.y * (FIGURE_HEIGHT / h);
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            // Skinned bounds don't follow the pose; never cull a figure.
            m.frustumCulled = false;
          }
        });
        const standTime = clips.walk ? passingTime(scene, clips.walk) : 0;
        return { scene, clips, standTime };
      })
      .catch(() => null);
    templates.set(id, p);
  }
  return p;
}

export function hasCharacterModel(id: string) {
  return id in CHARACTER_MODELS;
}

/** Load (once) and clone a character, standing. Resolves null on failure. */
export async function spawnCharacter(
  id: string,
): Promise<CharacterInstance | null> {
  const t = await loadTemplate(id);
  if (!t) return null;
  const root = new THREE.Group();
  const body = cloneSkinned(t.scene) as THREE.Group;
  root.add(body);
  root.userData.sharedModel = true;
  const mixer = new THREE.AnimationMixer(body);
  let current: THREE.AnimationAction | null = null;
  const play = (motion: Motion) => {
    const clip = motion === "stand" ? t.clips.walk : t.clips[motion];
    current?.stop();
    if (!clip) return;
    current = mixer.clipAction(clip).reset().play();
    if (motion === "stand") {
      current.time = t.standTime;
      current.paused = true;
    }
    mixer.update(0);
  };
  play("stand");
  return { root, mixer, play, update: (dt) => mixer.update(dt) };
}
