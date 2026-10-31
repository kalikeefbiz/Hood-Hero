import { z } from "zod";
import type { GameState } from "../core/GameState";
const id = z.string().min(1),
  n = z.number().finite(),
  nonnegative = n.nonnegative(),
  integer = nonnegative.int();
const zone = z.enum(["downtown", "rio", "south", "resevoir", "nawf"]),
  faction = z.enum(["angels", "backstreet", "blocks", "blips", "muds"]);
const zoneScores = z.object({
  downtown: n,
  rio: n,
  south: n,
  resevoir: n,
  nawf: n,
});
const factionScores = z.object({
  angels: n,
  backstreet: n,
  blocks: n,
  blips: n,
  muds: n,
});
const record = <T extends z.ZodType>(schema: T) => z.record(id, schema);
const relationship = z.object({
  trust: n,
  respect: n,
  affection: n,
  grievance: n,
  history: z.array(id),
});
const character = z.object({
  id,
  name: z.string(),
  alias: z.string().optional(),
  description: z.string(),
  home: zone,
  affiliation: faction.nullable(),
  status: z.enum(["active", "arrested", "dead", "laying-low"]),
  availableDay: integer,
  lastActionDay: integer,
  traits: z.object({ loyalty: n, ambition: n, risk: n, lawful: n }),
  skills: z.object({ social: n, work: n, recovery: n }),
  goals: z.array(z.enum(["income", "status", "stability", "loyalty"])),
  wallet: z.object({ clean: nonnegative, illicit: nonnegative }),
  relationships: record(relationship),
  memories: z.array(
    z.object({
      eventId: id,
      day: integer,
      about: id,
      meaning: z.string(),
      weight: n,
    }),
  ),
  known: z.array(id),
  stress: n,
  notoriety: n,
  police: n,
  influence: n,
  legitimacy: n,
  neighborhoodStanding: zoneScores,
  organizationStanding: factionScores,
  possessions: z.array(id),
  recurringLawfulIncome: nonnegative,
  authority: n,
  rivalThreat: n,
});
const schema = z.object({
  version: z.literal(1),
  day: integer.min(1),
  ap: integer.max(2),
  rng: integer.max(4294967295),
  nextId: integer.min(1),
  playerId: id,
  characters: record(character),
  zones: z.record(
    zone,
    z.object({
      id: zone,
      name: z.string(),
      subtitle: z.string(),
      description: z.string(),
      police: n,
      commerce: n,
      support: n,
      organizations: z.array(faction),
      controller: faction.nullable(),
    }),
  ),
  factions: z.record(
    faction,
    z.object({
      id: faction,
      name: z.string(),
      color: z.string(),
      home: zone,
      leaders: z.array(id),
      allies: z.array(faction),
      enemies: z.array(faction),
      resources: nonnegative,
      instability: n,
      influence: zoneScores,
      priority: z.enum(["commerce", "stability", "status"]),
    }),
  ),
  properties: record(
    z.object({
      id,
      name: z.string(),
      owner: id,
      possession: z.object({
        kind: z.enum(["character", "group", "market"]),
        id,
      }),
      value: nonnegative,
      provenance: z.enum(["clean", "illicit"]),
    }),
  ),
  incidents: record(
    z.object({
      id,
      kind: z.literal("property-dispute"),
      title: z.string(),
      victim: id,
      participants: z.array(id),
      organization: faction,
      property: id,
      startedDay: integer,
      demand: nonnegative,
      minimumDemand: nonnegative,
      escalation: n,
      negotiated: z.boolean(),
      informed: z.boolean(),
      leadershipAware: z.boolean(),
      helpRequested: z.boolean(),
      deadline: integer,
      status: z.enum(["active", "resolved", "abandoned"]),
      resolution: z
        .enum(["buyback", "recovered", "settlement", "sold"])
        .optional(),
    }),
  ),
  events: z.array(
    z.object({
      id,
      day: integer,
      category: z.enum([
        "social",
        "money",
        "city",
        "incident",
        "crew",
        "risk",
        "system",
      ]),
      text: z.string(),
      actors: z.array(id),
      observedBy: z.array(id),
    }),
  ),
  commitments: z.array(
    z.object({
      id,
      actor: id,
      beneficiary: id,
      dueDay: integer,
      kind: z.literal("errand"),
      status: z.enum(["pending", "completed", "failed"]),
    }),
  ),
  crew: z.object({
    members: z.array(id).max(5),
    capacity: integer.min(1).max(5),
    successor: id.nullable(),
  }),
  assets: z.array(
    z.object({
      id,
      owner: id,
      value: nonnegative,
      provenance: z.enum(["clean", "illicit"]),
      recurringIncome: nonnegative,
    }),
  ),
  ledger: z.array(
    z.object({
      day: integer,
      amount: n,
      provenance: z.enum(["clean", "illicit"]),
      reason: z.string(),
    }),
  ),
  progression: z.object({
    cleanEarned: nonnegative,
    illicitEarned: nonnegative,
    jobs: integer,
    retired: z.boolean(),
  }),
  end: z
    .enum(["legitimate-exit", "underlord", "arrested", "killed"])
    .nullable(),
});
export const SAVE_KEY = "blackhouse.syndicate.v1";
export const AUTO_KEY = SAVE_KEY + ".auto";
export function serialize(s: GameState): string {
  return JSON.stringify({ format: "syndicate", version: 1, state: s });
}
export function deserialize(raw: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Save could not be read. Your existing game has not been changed.",
    );
  }
  const envelope = z
    .object({
      format: z.literal("syndicate"),
      version: z.literal(1),
      state: schema,
    })
    .safeParse(parsed);
  if (!envelope.success)
    throw new Error(
      "Incompatible or damaged save. Expected Syndicate save version 1.",
    );
  const s: GameState = envelope.data.state;
  const exists = (id: string) => !!s.characters[id];
  if (
    !exists(s.playerId) ||
    new Set(s.crew.members).size !== s.crew.members.length ||
    s.crew.members.length > s.crew.capacity ||
    !s.crew.members.every(exists) ||
    Object.values(s.characters).some((c) => !c.known.every(exists)) ||
    Object.values(s.incidents).some(
      (i) =>
        !exists(i.victim) ||
        !i.participants.every(exists) ||
        !s.properties[i.property],
    ) ||
    s.commitments.some((o) => !exists(o.actor) || !exists(o.beneficiary))
  )
    throw new Error("Save contains missing or invalid world references.");
  return s;
}
export function saveGame(storage: Storage, s: GameState, key = SAVE_KEY) {
  try {
    storage.setItem(key, serialize(s));
  } catch {
    throw new Error(
      "Storage is unavailable or full. This game remains playable in this tab.",
    );
  }
}
export function loadGame(storage: Storage, key = SAVE_KEY): GameState | null {
  const raw = storage.getItem(key);
  return raw ? deserialize(raw) : null;
}
