import { z } from "zod";
const n = z.number().finite(),
  score = n.min(0).max(100),
  day = n.int().nonnegative(),
  id = z.string().min(1);
const faction = z.enum(["angels", "backstreet", "blocks", "blips", "muds"]),
  zone = z.enum(["downtown", "rio", "south", "reservoir", "nawf"]);
const kind = z.enum([
  "economic",
  "community",
  "support",
  "challenge",
  "defense",
  "reputation-loss",
  "disruption",
]);
const decision = z.enum([
  "maintain",
  "expand",
  "contest",
  "recover",
  "economy",
]);
const territory = z.object({
  factions: z.record(
    faction,
    z.object({
      presence: score,
      influence: score,
      economy: score,
      support: score,
      pressure: score,
    }),
  ),
  controller: faction.nullable(),
  contested: z.boolean(),
  candidate: faction.nullable(),
  candidateDays: day,
  weakDays: day,
  lastResolvedDay: day,
  controlSince: day,
  lawfulEconomy: score,
  changes: z.array(
    z.object({
      day,
      from: faction.nullable(),
      to: faction.nullable(),
      eventId: id,
    }),
  ),
});
export const strategicSchema = z.object({
  territories: z.record(zone, territory),
  strategies: z.record(
    faction,
    z.object({
      nextDecisionDay: day,
      lastDecision: decision.nullable(),
      target: zone,
      priority: zone.nullable(),
      priorityUntil: day,
      history: z.array(
        z.object({ day, kind: decision, zone, cost: day, eventId: id }),
      ),
    }),
  ),
  effects: z.array(
    z.object({
      actor: id,
      participants: z.array(id).optional(),
      faction: faction.nullable(),
      zone,
      kind,
      magnitude: n.positive().max(20),
      cause: id,
      day,
      eventId: id,
    }),
  ),
  contributions: z.record(faction, n.nonnegative()),
  membershipDay: day.nullable(),
  lastActionDay: day,
  lastPromotionDay: day,
  businesses: z.array(
    z.object({
      id,
      definition: z.enum(["repair", "courier", "laundry"]),
      acquiredDay: day,
      lastOperatingDay: day,
      status: z.enum([
        "operating",
        "profitable",
        "struggling",
        "sold",
        "closed",
      ]),
      provenance: z.enum(["clean", "illicit"]),
      condition: score,
      lastNet: n,
      totalNet: n,
      profitableDays: day,
      history: z.array(z.object({ day, revenue: day, expenses: day, net: n })),
    }),
  ),
  lawfulStreak: day,
  lastCrimeDay: day.nullable(),
  ending: z
    .object({
      day,
      kind: z.enum(["legitimate-exit", "underlord", "killed"]),
      eventId: id,
    })
    .nullable(),
});
