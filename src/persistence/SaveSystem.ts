import {
  change,
  relationship as relationshipOf,
} from "../systems/Relationships";
import { validateConsignments } from "../systems/Consignment";
import { STREET_BALANCE } from "../content/street";
import {
  quannySchema,
  newQuannyState,
  QUANNY_HOME,
} from "../systems/QuannyState";
import { canonicalCharacters } from "../content/characters";
import { validateQuanny } from "../systems/Quanny";
import { dangerSchema, newDangerState } from "../systems/DangerState";
import { validateDangerReferences } from "../systems/Danger";
import { strategicSchema } from "./StrategicSchema";
import { streetSchema } from "./StreetSchema";
import { z } from "zod";
import { JOBS } from "../content/jobs";
import { ENCOUNTERS } from "../content/encounters";
import type { GameState } from "../core/GameState";
const id = z.string().min(1),
  n = z.number().finite(),
  nonnegative = n.nonnegative(),
  integer = nonnegative.int();
const zone = z.enum(["downtown", "rio", "south", "reservoir", "nawf"]),
  faction = z.enum(["angels", "backstreet", "blocks", "blips", "muds"]);
const zoneScores = z.object({
  downtown: n,
  rio: n,
  south: n,
  reservoir: n,
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
  agency: z.object({
    lastAssignmentDay: integer,
    lastOfferDay: integer,
    lastRequestDay: integer,
    unreasonableRequests: integer,
  }),
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
  connections: z.array(id),
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
import { BUILDS, HAIR, TOPS } from "../board/presence";
// Strategy-board lab: where the player physically is and how they look.
const presenceSchema = z.object({
  location: z.string().min(1),
  zone,
  arrivedDay: integer.min(1),
  trail: z
    .array(z.object({ location: z.string(), day: integer.min(1) }))
    .max(12),
  appearance: z.object({
    skin: z.string(),
    hair: z.enum(HAIR),
    hairColor: z.string(),
    top: z.enum(TOPS),
    topColor: z.string(),
    bottomColor: z.string(),
    shoeColor: z.string(),
    chain: z.boolean(),
    build: z.enum(BUILDS),
    model: z.string().optional(),
  }),
});
const schema = z.object({
  presence: presenceSchema.optional(),
  quanny: quannySchema.default(newQuannyState),
  danger: dangerSchema.default(() => newDangerState()),
  version: z.literal(8),
  street: streetSchema,
  strategic: strategicSchema,
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
      kind: z.enum([
        "errand",
        "recover-property",
        "employment-shift",
        "crew-activity",
        "supplier-debt",
      ]),
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
      dangerSceneId: id.optional(),
      crewOfferId: id.optional(),
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
  assignments: z.array(
    z.object({
      id,
      participants: z.array(id).length(2),
      member: id,
      activity: z.enum([
        "work",
        "information",
        "social",
        "partner-gig",
        "partner-crime",
      ]),
      objective: z.string(),
      conditions: z.array(z.string()),
      relationshipEffect: z.string(),
      status: z.enum(["proposed", "refused", "accepted", "active", "resolved"]),
      createdDay: integer,
      dueDay: integer,
      apCost: integer.max(2),
      compensation: nonnegative,
      expectedBenefit: nonnegative,
      skill: z.enum(["work", "social", "recovery"]),
      chance: nonnegative.max(1),
      risk: z.string(),
      experience: nonnegative,
      commitmentId: id.optional(),
      offerId: id.optional(),
      success: z.boolean().optional(),
      outcome: z.string().optional(),
      eventIds: z.array(id),
    }),
  ),
  crewOffers: z.array(
    z.object({
      id,
      member: id,
      contact: id,
      activity: z.enum(["partner-gig", "social", "information"]),
      createdDay: integer,
      expiresDay: integer,
      activityDay: integer,
      status: z.enum(["pending", "accepted", "declined", "expired"]),
      assignmentId: id.optional(),
    }),
  ),
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
// The strategy-board lab keeps its own slots so it can never touch saves from
// the production game, even on the same web origin.
export const SAVE_KEY = "blackhouse.hoodhero-lab.v1";
export const AUTO_KEY = SAVE_KEY + ".auto";
export function serialize(s: GameState): string {
  return JSON.stringify({ format: "syndicate", version: 8, state: s });
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
      version: z.literal(8),
      state: schema,
    })
    .safeParse(parsed);
  if (!envelope.success)
    throw new Error(
      "Incompatible or damaged save. Expected Hood Hero save version 8. Start a new test run from the new game menu.",
    );
  const s: GameState = envelope.data.state;
  const addQuanny = !s.characters.quanny;
  // Additive v8 migration: older Lab saves retain every existing character and record.
  for (const c of canonicalCharacters().filter((c) =>
    ["quanny", "mr-lewis"].includes(c.id),
  ))
    s.characters[c.id] ??= c;
  if (addQuanny) {
    const q = s.characters.quanny;
    q.known = [
      "mega",
      ...Object.values(s.characters)
        .filter(
          (c) => c.id !== q.id && c.id !== s.playerId && c.home === q.home,
        )
        .map((c) => c.id),
    ];
    q.connections = q.known.filter((id) => id !== "mega");
    for (const id of q.connections) {
      relationshipOf(q, id);
      change(q, id, {
        trust: s.characters[id].affiliation === q.affiliation ? 27 : 8,
        respect: s.characters[id].influence / 5,
      });
    }
    relationshipOf(q, "mega").respect = 35;
  }
  if (
    s.quanny.met &&
    !s.quanny.knownLocation &&
    (s.quanny.business === "open" ||
      s.street.agreements.some(
        (a) => a.debtor === "quanny" && a.supplier === s.playerId,
      ))
  )
    s.quanny.knownLocation = QUANNY_HOME;
  validateDangerReferences(s);
  validateQuanny(s);
  validateConsignments(s);
  const exists = (id: string) => !!s.characters[id];
  const st = s.street;
  const strategy = s.strategic;
  if (
    new Set(s.assets.map((a) => a.id)).size !== s.assets.length ||
    new Set(strategy.businesses.map((b) => b.definition)).size !==
      strategy.businesses.length ||
    strategy.businesses.some((b) => b.lastOperatingDay > s.day) ||
    Object.entries(strategy.territories).some(
      ([zone, t]) =>
        t.controller !== s.zones[zone as keyof typeof s.zones].controller ||
        t.controlSince > s.day ||
        !t.changes.every((c) => s.events.some((e) => e.id === c.eventId)),
    ) ||
    strategy.effects.some(
      (x) =>
        !s.events.some((e) => e.id === x.eventId) ||
        (!exists(x.actor) && !s.factions[x.actor as keyof typeof s.factions]),
    ) ||
    Object.values(strategy.strategies).some(
      (x) => !x.history.every((h) => s.events.some((e) => e.id === h.eventId)),
    ) ||
    new Set(strategy.businesses.map((b) => b.id)).size !==
      strategy.businesses.length ||
    strategy.businesses.some(
      (b) =>
        !s.assets.some(
          (a) =>
            a.id === b.id &&
            a.owner === s.playerId &&
            a.provenance === b.provenance,
        ) ||
        (["sold", "closed"].includes(b.status) &&
          s.assets.some(
            (a) => a.id === b.id && (a.value !== 0 || a.recurringIncome !== 0),
          )),
    ) ||
    (strategy.ending &&
      !s.events.some((e) => e.id === strategy.ending!.eventId))
  )
    throw new Error("Save contains invalid strategic or business references.");
  const invalidStreet =
    new Set(
      [...st.lots, ...st.agreements, ...st.transactions, ...st.custody].map(
        (x) => x.id,
      ),
    ).size !==
      st.lots.length +
        st.agreements.length +
        st.transactions.length +
        st.custody.length ||
    st.lots.some(
      (l) =>
        !exists(l.owner) ||
        !exists(l.supplier) ||
        (l.sourceLotId !== undefined &&
          !st.lots.some(
            (source) =>
              source.id === l.sourceLotId &&
              source.owner === l.supplier &&
              (source.transferred ?? 0) >= l.received,
          )) ||
        (l.transferred ?? 0) !==
          st.lots
            .filter((child) => child.sourceLotId === l.id)
            .reduce((n, child) => n + child.received, 0) ||
        l.remaining +
          l.lost +
          (l.transferred ?? 0) +
          st.transactions
            .filter((t) => t.lotId === l.id)
            .reduce((n, t) => n + t.sold, 0) !==
          l.received ||
        st.transactions
          .filter((t) => t.lotId === l.id)
          .reduce((n, t) => n + t.gross, 0) !== l.collected ||
        st.transactions
          .filter((t) => t.lotId === l.id)
          .reduce((n, t) => n + t.lost, 0) !== l.lost ||
        st.transactions
          .filter((t) => t.lotId === l.id)
          .reduce((n, t) => n + t.loss, 0) !== l.losses ||
        st.transactions
          .filter((t) => t.lotId === l.id)
          .reduce((n, t) => n + t.crewPaid, 0) !== l.crewPaid ||
        (l.agreementId
          ? !st.agreements.some(
              (a) =>
                a.id === l.agreementId &&
                a.lotId === l.id &&
                a.balance === l.owed &&
                a.repaid === l.paid &&
                a.original === l.cost,
            )
          : l.owed !== 0 || l.paid !== l.cost),
    ) ||
    st.agreements.some(
      (a) =>
        !exists(a.supplier) ||
        !exists(a.debtor) ||
        (a.createdDay !== undefined &&
          a.reserve !== (a.status === "pending" ? a.balance : 0)) ||
        a.collections?.some(
          (c) => c.day > s.day || !s.events.some((e) => e.id === c.eventId),
        ) ||
        (a.createdDay !== undefined &&
          (a.createdDay > s.day ||
            a.dueDay !== a.createdDay + STREET_BALANCE.deadline ||
            !st.lots.some(
              (l) => l.id === a.lotId && l.received === a.quantity,
            ))) ||
        a.original !== a.repaid + a.balance ||
        (a.status === "fulfilled") !== (a.balance === 0) ||
        !st.lots.some(
          (l) =>
            l.id === a.lotId &&
            l.supplier === a.supplier &&
            l.owner === a.debtor,
        ) ||
        !s.commitments.some(
          (c) =>
            c.id === a.commitmentId &&
            c.kind === "supplier-debt" &&
            c.actor === a.debtor &&
            c.requester === a.supplier,
        ) ||
        !a.history.every((id) => s.events.some((e) => e.id === id)),
    ) ||
    st.transactions.some(
      (t) =>
        !exists(t.actor) ||
        (t.partner && !exists(t.partner)) ||
        !st.lots.some((l) => l.id === t.lotId && l.owner === t.actor) ||
        !s.events.some((e) => e.id === t.eventId),
    ) ||
    st.custody.some(
      (r) =>
        !exists(r.character) ||
        (r.releaseDay !== null &&
          (r.releaseDay < r.arrestDay ||
            !s.events.some((e) => e.id === r.eventId))),
    ) ||
    Object.keys(st.exposure).some((id) => !exists(id));
  if (invalidStreet)
    throw new Error("Save contains invalid street economy or custody records.");
  if (
    !exists(s.playerId) ||
    new Set(s.crew.members).size !== s.crew.members.length ||
    s.crew.members.length > s.crew.capacity ||
    !s.crew.members.every(exists) ||
    Object.values(s.characters).some(
      (c) =>
        !c.known.every(exists) ||
        new Set(c.connections).size !== c.connections.length ||
        !c.connections.every((id) => exists(id) && c.known.includes(id)),
    ) ||
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
    s.assignments.some(
      (a) =>
        !exists(a.member) ||
        !a.participants.every(exists) ||
        !a.participants.includes(a.member) ||
        !a.participants.includes(s.playerId) ||
        (a.commitmentId &&
          !s.commitments.some(
            (c) => c.id === a.commitmentId && c.kind === "crew-activity",
          )) ||
        (a.offerId && !s.crewOffers.some((o) => o.id === a.offerId)) ||
        !a.eventIds.every((id) => s.events.some((e) => e.id === id)),
    ) ||
    s.crewOffers.some(
      (o) =>
        !exists(o.member) ||
        !exists(o.contact) ||
        (o.assignmentId && !s.assignments.some((a) => a.id === o.assignmentId)),
    ) ||
    s.encounters.some(
      (e) =>
        !ENCOUNTERS.some((d) => d.id === e.definitionId) ||
        !e.participants.every(exists) ||
        (e.crewOfferId && !s.crewOffers.some((o) => o.id === e.crewOfferId)) ||
        (e.sourceEventId && !s.events.some((x) => x.id === e.sourceEventId)) ||
        (e.incidentId && !s.incidents[e.incidentId]),
    ) ||
    new Set(
      [
        ...s.commitments,
        ...s.encounters,
        ...s.events,
        ...s.assignments,
        ...s.crewOffers,
      ].map((x) => x.id),
    ).size !==
      s.commitments.length +
        s.encounters.length +
        s.events.length +
        s.assignments.length +
        s.crewOffers.length
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
