import { z } from "zod";
import { locationById } from "../board/locations";
import type { GameState } from "../core/GameState";
const id = z.string().min(1),
  day = z.number().int().nonnegative();
export const quannySchema = z.object({
  rng: z.number().int().min(0).max(4294967295).default(9009),
  met: z.boolean(),
  meetingDay: day.optional(),
  location: id.optional(),
  knownLocation: z.literal("reservoir.lil-jays").optional(),
  actual: z
    .enum(["angels", "blocks", "backstreet", "blips", "muds"])
    .nullable(),
  claim: z
    .enum(["angels", "blocks", "backstreet", "blips", "muds", "unaffiliated"])
    .nullable(),
  deception: z.enum(["none", "unknown", "known"]),
  shooting: z.enum(["escape", "minor", "hospital"]).optional(),
  business: z.enum(["new", "open", "blocked"]),
  blockedDay: day.optional(),
  repairBaseline: z.number().nonnegative(),
  repairHistory: z.array(id),
  history: z.array(id),
});
export type QuannyState = z.infer<typeof quannySchema>;
export const newQuannyState = (): QuannyState => ({
  rng: 9009,
  met: false,
  actual: null,
  claim: null,
  deception: "none",
  business: "new",
  repairBaseline: 0,
  repairHistory: [],
  history: [],
});
export const QUANNY_HOME = "reservoir.lil-jays";
export const quannyConversation = (s: import("../core/GameState").GameState) =>
  s.encounters.find(
    (e) =>
      e.definitionId === "quanny" &&
      ["pending", "active"].includes(e.status) &&
      !e.deferred,
  );
export function quannyLocation(s: import("../core/GameState").GameState) {
  const scene = s.danger.scenes.find(
    (x) => x.npc === "quanny" && x.status === "open",
  );
  if (scene) return scene.location;
  return quannyConversation(s)
    ? (s.quanny.location ?? QUANNY_HOME)
    : QUANNY_HOME;
}

export const QUANNY_LOCATION_REVEAL =
  "If you need me again, pull up to Lil Jay’s Market. I’m usually outside.";
export function quannyAddress(s: GameState) {
  const location = locationById(QUANNY_HOME)!;
  return `${location.name}, ${s.zones[location.zone].name}`;
}
export function quannyCollectionInstruction(s: GameState, dueDay: number) {
  return `Collect from Quanny — ${quannyAddress(s)}. Due Day ${dueDay}.`;
}
