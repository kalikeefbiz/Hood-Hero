import type { EncounterDefinition } from "../core/Encounter";
import {
  hospitalStay,
  resolveStreetScene,
  sceneDialogue,
  type StreetResponse,
} from "../systems/Danger";
export { resolveStreetScene };
export const DANGER_ENCOUNTER: EncounterDefinition = {
  id: "living-danger",
  type: "request",
  participants: [],
  priority: 95,
  trigger: () => [], // Created by an exposure with concrete participants and context.
  eligible: (s, e) =>
    !s.end &&
    !hospitalStay(s) &&
    s.danger.scenes.some(
      (x) => x.id === e.dangerSceneId && x.status === "open" && x.day === s.day,
    ),
  dialogue: (s, e) => {
    const scene = s.danger.scenes.find((x) => x.id === e.dangerSceneId)!;
    return scene.outcome ?? sceneDialogue(s, scene);
  },
  responses: (s) =>
    (
      [
        ...(s.characters[s.playerId].affiliation
          ? [
              ["identify", "Tell them who you run with"] as [
                StreetResponse,
                string,
              ],
            ]
          : []),
        ["listen", "Hear them out"],
        ["explain", "Explain yourself respectfully"],
        ["apologize", "Acknowledge their concern"],
        ["leave", "Walk away"],
        ["disrespect", "Dismiss them disrespectfully"],
      ] as [StreetResponse, string][]
    ).map(([choice, label]) => ({
      id: choice,
      label,
      detail: "Your words and the circumstances matter · No AP",
      effect: { type: "danger" as const, choice },
    })),
  rules: { replay: "read-only", expiresWithIncident: false },
};
