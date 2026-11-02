import { z } from "zod";
import { JOBS } from "../content/jobs";
import { ENCOUNTERS } from "../content/encounters";
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
const consequence = z.object({ trust: n, respect: n, grievance: n });
const schema = z.object({
  version: z.literal(4),
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
      interventions: z.array(
        z.object({ actor: id, type: z.string(), eventId: id, day: integer }),
      ),
      resolvedEventId: id.optional(),
      resolvedBy: id.optional(),
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
      importance: z
        .enum(["routine", "personal", "major", "critical"])
        .optional(),
      title: z.string().optional(),
      incidentId: id.optional(),
      commitmentId: id.optional(),
      factionId: faction.optional(),
      presentationKey: id.optional(),
      expiresOnIncidentClose: z.boolean().optional(),
    }),
  ),
  commitments: z.array(
    z.object({
      id,
      actor: id,
      beneficiary: id,
      dueDay: integer,
      kind: z.enum(["errand", "recover-property", "employment-shift"]),
      employmentId: id.optional(),
      status: z.enum([
        "pending",
        "completed",
        "failed",
        "fulfilled",
        "broken",
        "released",
        "superseded",
      ]),
      origin: id,
      requester: id,
      createdDay: integer,
      incidentId: id.optional(),
      evidence: z.array(id),
      warned: z.boolean(),
      consequences: z.object({
        fulfilled: consequence,
        broken: consequence,
        released: consequence,
      }),
    }),
  ),
  encounters: z.array(
    z.object({
      id,
      definitionId: id,
      sourceEventId: id.optional(),
      incidentId: id.optional(),
      participants: z.array(id),
      createdDay: integer,
      dueDay: integer.optional(),
      status: z.enum(["pending", "active", "acknowledged", "closed"]),
      selectedResponses: z.array(
        z.object({ id, day: integer, eventIds: z.array(id) }),
      ),
      followUpPending: z.boolean(),
      deferred: z.boolean(),
    }),
  ),
  acknowledgedEvents: z.array(id),
  crew: z.object({
    members: z.array(id).max(5),
    capacity: integer.min(1).max(5),
    successor: id.nullable(),
  }),
  employment: z.array(
    z.object({
      id,
      actor: id,
      jobId: id,
      employer: id,
      location: zone,
      status: z.enum(["employed", "resigned", "terminated"]),
      hiredDay: integer,
      endedDay: integer.optional(),
      wage: nonnegative,
      workdays: z.array(integer.max(6)).min(1).max(7),
      attendance: z.array(
        z.object({
          day: integer,
          status: z.enum(["worked", "missed", "excused"]),
          eventId: id,
        }),
      ),
      reliability: nonnegative.max(100),
      performance: integer,
      warnings: integer,
      rehireDay: integer,
      timeOffDays: z.array(integer),
      raised: z.boolean(),
      eventIds: z.array(id),
    }),
  ),
  employmentSearch: record(
    z.object({
      eligibleDay: integer,
      offeredJob: id.optional(),
      lastApplicationDay: integer.optional(),
      lastGigDay: integer.optional(),
    }),
  ),
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
  return JSON.stringify({ format: "syndicate", version: 4, state: s });
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
      version: z.literal(4),
      state: schema,
    })
    .safeParse(parsed);
  if (!envelope.success)
    throw new Error(
      "Incompatible or damaged save. Expected Hood Hero save version 4. Start a new test run from the new game menu.",
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
    s.commitments.some(
      (o) =>
        !exists(o.actor) ||
        !exists(o.beneficiary) ||
        !exists(o.requester) ||
        (o.incidentId && !s.incidents[o.incidentId]),
    ) ||
    s.employment.some(
      (e) =>
        !exists(e.actor) ||
        !exists(e.employer) ||
        !JOBS.some((j) => j.id === e.jobId) ||
        new Set(e.attendance.map((a) => a.day)).size !== e.attendance.length ||
        ![...e.eventIds, ...e.attendance.map((a) => a.eventId)].every((id) =>
          s.events.some((x) => x.id === id),
        ),
    ) ||
    new Set(
      s.employment.filter((e) => e.status === "employed").map((e) => e.actor),
    ).size !== s.employment.filter((e) => e.status === "employed").length ||
    s.commitments.some(
      (c) =>
        c.kind === "employment-shift" &&
        !s.employment.some(
          (e) => e.id === c.employmentId && e.actor === c.actor,
        ),
    ) ||
    s.encounters.some(
      (e) =>
        !ENCOUNTERS.some((d) => d.id === e.definitionId) ||
        !e.participants.every(exists) ||
        (e.sourceEventId && !s.events.some((x) => x.id === e.sourceEventId)) ||
        (e.incidentId && !s.incidents[e.incidentId]),
    ) ||
    new Set([...s.commitments, ...s.encounters, ...s.events].map((x) => x.id))
      .size !==
      s.commitments.length + s.encounters.length + s.events.length
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
