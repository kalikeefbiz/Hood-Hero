import { z } from "zod";
const id = z.string().min(1),
  day = z.number().int().nonnegative();
const faction = z.enum(["angels", "backstreet", "blocks", "blips", "muds"]);
export const dangerSchema = z.object({
  rng: z.number().int().min(0).max(4294967295),
  exposure: z.object({ day, keys: z.array(id), exceptionalDay: day }),
  recognition: z.array(
    z.object({
      observer: id,
      subject: id,
      affiliation: faction.nullable(),
      source: z.enum(["introduction", "sponsorship", "witness", "associate"]),
      eventId: id,
      day,
      location: id,
    }),
  ),
  conflicts: z.array(
    z.object({
      id,
      participants: z.array(id).length(2),
      cause: z.string().min(1),
      originEvent: id,
      seriousness: z.number().min(0).max(100),
      lethal: z.boolean(),
      state: z.enum(["unresolved", "worsening", "cooling", "settled"]),
      scope: z.enum(["personal", "circle"]),
      associates: z.array(id),
      intent: z.enum(["avoid", "talk", "seek", "involve"]),
      createdDay: day,
      updatedDay: day,
      history: z.array(z.object({ eventId: id, day, outcome: z.string() })),
    }),
  ),
  scenes: z.array(
    z.object({
      id,
      npc: id,
      location: id,
      day,
      motive: z.enum([
        "introduction",
        "family",
        "corner",
        "debt",
        "history",
        "war",
      ]),
      contextEvent: id.optional(),
      conflictId: id.optional(),
      status: z.enum(["open", "resolved", "left"]),
      outcome: z.string().optional(),
    }),
  ),
  injuries: z.array(
    z.object({
      id,
      eventId: id,
      kind: z.enum(["assault", "shooting"]),
      severity: z.enum(["minor", "serious"]).optional(),
      admittedDay: day,
      releaseDay: day,
      bill: z.number().int().nonnegative(),
      paid: z.number().nonnegative(),
      discharged: z.boolean(),
    }),
  ),
});
export type DangerState = z.infer<typeof dangerSchema>;
export type Conflict = DangerState["conflicts"][number];
export type StreetScene = DangerState["scenes"][number];
export const newDangerState = (seed = 2026): DangerState => ({
  rng: (seed ^ 0x8da6b343) >>> 0,
  exposure: { day: 0, keys: [], exceptionalDay: 0 },
  recognition: [],
  conflicts: [],
  scenes: [],
  injuries: [],
});
