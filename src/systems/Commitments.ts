import { applyInfluence } from "./Territory";
import type {
  Commitment,
  CommitmentStatus,
  GameState,
  Incident,
} from "../core/GameState";
import { record } from "../core/EventLog";
import { propertyPromiseOutcome } from "../content/commitments";
import { change, remember } from "./Relationships";

// Incident.deadline is an AGE, while commitments use absolute days.
export const incidentDueDay = (i: Incident) => i.startedDay + i.deadline;
export const incidentPromise = (s: GameState, incidentId: string) =>
  s.commitments.find(
    (c) =>
      c.kind === "recover-property" &&
      c.actor === s.playerId &&
      c.incidentId === incidentId,
  );
export const promiseConsequences: Commitment["consequences"] = {
  fulfilled: { trust: 8, respect: 5, grievance: 0 },
  broken: { trust: -18, respect: -8, grievance: 14 },
  released: { trust: 0, respect: 0, grievance: 0 },
};
export function promiseHelp(s: GameState, i: Incident, origin: string) {
  if (
    i.status !== "active" ||
    s.day >= incidentDueDay(i) ||
    incidentPromise(s, i.id)
  )
    return;
  const c: Commitment = {
    id: `commitment-${s.nextId++}`,
    origin,
    requester: i.victim,
    actor: s.playerId,
    beneficiary: i.victim,
    createdDay: s.day,
    dueDay: incidentDueDay(i),
    kind: "recover-property",
    incidentId: i.id,
    status: "pending",
    evidence: [],
    warned: false,
    consequences: structuredClone(promiseConsequences),
  };
  s.commitments.push(c);
  const e = record(
    s,
    "social",
    `You promised Cuzzo you would help recover his chains before day ${c.dueDay}. Words alone earn no credit.`,
    [s.playerId, i.victim],
    [s.playerId, i.victim],
    { commitmentId: c.id, incidentId: i.id },
  );
  remember(
    s,
    i.victim,
    s.playerId,
    e.id,
    "Promised to help me recover my chains.",
    0,
  );
}
export function finishCommitment(
  s: GameState,
  c: Commitment,
  status: Exclude<CommitmentStatus, "pending" | "completed" | "failed">,
  evidence: string[],
  outcome: { title: string; text: string; memory: string; weight: number },
) {
  if (c.status !== "pending") return;
  c.status = status;
  const requester = s.characters[c.requester];
  if (
    c.actor === s.playerId &&
    status === "fulfilled" &&
    requester.affiliation
  ) {
    applyInfluence(s, {
      actor: c.actor,
      participants: [requester.id],
      faction: requester.affiliation,
      zone: requester.home,
      kind: "support",
      magnitude: 2,
      cause: "A fulfilled commitment reinforced organizational reliability.",
    });
    if (s.characters[c.actor].affiliation === requester.affiliation)
      s.strategic.contributions[requester.affiliation] += 8;
  }
  c.evidence = [...new Set(evidence)];
  const fulfilled = status === "fulfilled",
    broken = status === "broken";
  change(
    s.characters[c.requester],
    c.actor,
    c.consequences[fulfilled ? "fulfilled" : broken ? "broken" : "released"],
  );
  const e = record(
    s,
    "social",
    outcome.text,
    [c.requester, c.actor],
    [c.requester, c.actor],
    {
      importance: broken ? "critical" : "major",
      factionId: s.characters[c.requester].affiliation ?? undefined,
      presentationKey: c.incidentId
        ? `incident:${c.incidentId}:outcome`
        : `commitment:${c.id}:outcome`,
      title: outcome.title,
      commitmentId: c.id,
      incidentId: c.incidentId,
    },
  );
  remember(s, c.requester, c.actor, e.id, outcome.memory, outcome.weight);
}
export function evaluatePromises(s: GameState, includeDeadlines = true) {
  for (const c of s.commitments.filter(
    (c) => c.kind === "recover-property" && c.status === "pending",
  )) {
    const i = s.incidents[c.incidentId!];
    if (i.status !== "active") {
      const contribution = i.interventions.filter(
        (x) =>
          x.actor === c.actor &&
          (x.type === "buyback" ||
            x.type === "recover" ||
            (x.type === "settlement" && i.resolution === "settlement")),
      );
      if (i.resolution !== "sold" && contribution.length)
        finishCommitment(
          s,
          c,
          "fulfilled",
          [
            ...contribution.map((x) => x.eventId),
            ...(i.resolvedEventId ? [i.resolvedEventId] : []),
          ],
          propertyPromiseOutcome("fulfilled"),
        );
      else
        finishCommitment(
          s,
          c,
          i.resolution === "sold" ? "broken" : "superseded",
          i.resolvedEventId ? [i.resolvedEventId] : [],
          propertyPromiseOutcome(
            i.resolution === "sold" ? "broken" : "superseded",
          ),
        );
    } else if (!includeDeadlines) continue;
    else if (s.day >= c.dueDay)
      finishCommitment(s, c, "broken", [], propertyPromiseOutcome("broken"));
    else if (c.dueDay - s.day <= 2 && !c.warned) {
      c.warned = true;
      record(
        s,
        "social",
        `Cuzzo is still waiting. Your promise expires when day ${c.dueDay} begins; ${c.dueDay - s.day} days remain. The situation may end sooner.`,
        [c.requester, c.actor],
        [c.requester, c.actor],
        {
          importance: "major",
          title: "Cuzzo is counting on you",
          factionId: s.characters[c.requester].affiliation ?? undefined,
          presentationKey: `commitment:${c.id}:deadline`,
          expiresOnIncidentClose: true,
          commitmentId: c.id,
          incidentId: i.id,
        },
      );
    }
  }
}
