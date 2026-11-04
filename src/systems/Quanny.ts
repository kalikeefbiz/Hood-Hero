import {
  player,
  cash,
  type GameState,
  type EncounterInstance,
  type FactionId,
} from "../core/GameState";
import { record } from "../core/EventLog";
import { locationById } from "../board/locations";
import { presenceOf } from "../board/presence";
import {
  addGrievance,
  hospitalStay,
  introductoryShooting,
  initiateConflict,
  witnessIdentity,
} from "./Danger";
import { change, connect, remember } from "./Relationships";
import {
  collectConsignment,
  consignmentTerms,
  frontMerchandise,
  receivable,
} from "./Consignment";
import {
  quannyConversation,
  QUANNY_HOME,
  QUANNY_LOCATION_REVEAL,
} from "./QuannyState";
export { quannyConversation };
const evidenceScore = (s: GameState) => {
  const p = player(s);
  return (
    p.organizationStanding.blocks +
    (p.affiliation === "blocks" ? 40 : 0) +
    Math.min(30, s.strategic.contributions.blocks) +
    Math.max(
      0,
      ...["mega", "contact-blocks", "mr-lewis"].map(
        (id) => (s.characters[id]?.relationships[p.id]?.trust ?? 0) - 35,
      ),
    )
  );
};
export function beginQuanny(s: GameState, location: string, kind: string) {
  const q = s.characters.quanny,
    l = locationById(location);
  if (
    s.quanny.met ||
    !["arrival", "gameplay"].includes(kind) ||
    !l ||
    l.zone !== "reservoir" ||
    !q ||
    q.status !== "active" ||
    q.availableDay > s.day ||
    hospitalStay(s)
  )
    return false;
  s.quanny.met = true;
  s.quanny.meetingDay = s.day;
  s.quanny.location = location;
  s.quanny.actual = player(s).affiliation;
  const e = record(
    s,
    "social",
    `Outside ${l.name}, Quanny steps over. “Aye, where you from?”`,
    [q.id, s.playerId],
    undefined,
    { title: "First contact · Quanny", importance: "major" },
  );
  s.quanny.history.push(e.id);
  witnessIdentity(s, q.id, s.playerId, e.id, location, "witness");
  witnessIdentity(s, s.playerId, q.id, e.id, location, "introduction", true);
  openQuanny(s, e.id);
  return true;
}
export function openQuanny(s: GameState, sourceEventId?: string) {
  const existing = s.encounters.find(
    (e) =>
      e.definitionId === "quanny" && ["pending", "active"].includes(e.status),
  );
  if (existing) {
    existing.deferred = false;
    existing.status = "active";
    return;
  }
  s.quanny.location = presenceOf(s).location;
  s.encounters.push({
    id: `quanny-${s.nextId++}`,
    definitionId: "quanny",
    participants: ["quanny", s.playerId],
    sourceEventId,
    createdDay: s.day,
    status: "active",
    selectedResponses: [],
    followUpPending: false,
    deferred: false,
  });
}
export function quannyError(s: GameState) {
  if (!s.quanny.met) return "Meet Quanny in the Reservoir first.";
  if (
    s.characters.quanny.status !== "active" ||
    s.characters.quanny.availableDay > s.day
  )
    return "Quanny is unavailable; his history and debts remain.";
  if (presenceOf(s).location !== QUANNY_HOME)
    return "Meet Quanny outside Lil Jay’s Market in the Reservoir.";
  return null;
}
export function businessError(s: GameState) {
  const q = s.characters.quanny,
    p = player(s),
    r = q.relationships[p.id];
  if (s.quanny.business !== "open")
    return "Quanny isn't accepting business. Credible connections or organizational progress may change that.";
  if (p.affiliation && s.factions.blocks.enemies.includes(p.affiliation))
    return "Your organizations are direct enemies.";
  if (
    (r?.grievance ?? 0) > 55 ||
    (r?.trust ?? 0) < -10 ||
    s.danger.conflicts.some(
      (c) =>
        c.participants.includes(q.id) &&
        c.participants.includes(p.id) &&
        c.state !== "settled" &&
        c.lethal,
    )
  )
    return "Unresolved personal hostility blocks business.";
  if (receivable(s, q.id)) return "Collect the existing agreement first.";
  if (consignmentTerms(s) && cash(q) < consignmentTerms(s, true)!.amount)
    return "Quanny has his operating money tied up. Try again after he earns more.";
  if (!consignmentTerms(s))
    return "Requires real night goods in your available inventory.";
  return null;
}
export function repairError(s: GameState) {
  if (s.quanny.business !== "blocked")
    return "No business connection needs reopening.";
  if (
    s.quanny.blockedDay === s.day ||
    evidenceScore(s) < s.quanny.repairBaseline + 30
  )
    return "Build meaningful new ties with people he respects, earn Blocc Boys standing or legitimately join them.";
  if (
    player(s).affiliation &&
    s.factions.blocks.enemies.includes(player(s).affiliation!)
  )
    return "An active faction rivalry still blocks business.";
  return null;
}
function revealQuannyLocation(s: GameState) {
  if (s.quanny.knownLocation) return;
  s.quanny.knownLocation = QUANNY_HOME;
  const e = record(s, "social", `Quanny: “${QUANNY_LOCATION_REVEAL}”`, [
    "quanny",
    s.playerId,
  ]);
  s.quanny.history.push(e.id);
}
function blockBusiness(s: GameState) {
  s.quanny.business = "blocked";
  s.quanny.blockedDay = s.day;
  s.quanny.repairBaseline = evidenceScore(s);
}
export function resolveQuanny(
  s: GameState,
  e: EncounterInstance,
  choice: string,
) {
  const p = player(s),
    q = s.characters.quanny,
    state = s.quanny;
  const note = (text: string, privateOnly = false) => {
    const event = record(
      s,
      "social",
      text,
      [q.id, p.id],
      privateOnly ? [q.id] : [q.id, p.id],
    );
    state.history.push(event.id);
    return event;
  };
  if (choice.startsWith("claim:")) {
    const claim = choice.slice(6) as FactionId | "unaffiliated";
    state.claim = claim;
    const truthful = claim === (p.affiliation ?? "unaffiliated");
    state.deception = truthful
      ? "none"
      : claim === "blocks"
        ? "known"
        : "unknown";
    connect(s, p.id, q.id);
    if (claim === "blocks" && !truthful) {
      note(
        "Quanny looks you over. “Man, quit playing with me.” He turns his back. The conversation is over.",
      );
      const secret = note(
        "Quanny recognized a false Blocc Boys claim immediately; he knows his organization's membership.",
        true,
      );
      const c = addGrievance(
        s,
        q.id,
        p.id,
        "Blocc Boys impersonation",
        secret.id,
        85,
        true,
      );
      c.intent = "seek";
      // The player heard the dismissal, not the private retaliation decision.
      p.memories = p.memories.filter((m) => m.eventId !== secret.id);
      blockBusiness(s);
      e.status = "acknowledged";
      return;
    }
    if (truthful)
      witnessIdentity(
        s,
        q.id,
        p.id,
        note("You answered Quanny about your affiliation.").id,
        state.location!,
        "witness",
        true,
      );
    if (claim === "angels") {
      const event = note(
        "“You see the wings, homie. Angels!” Quanny reaches for his gun and fires.",
      );
      const c = addGrievance(
        s,
        q.id,
        p.id,
        "Claimed Gabriel’s Angels during first contact",
        event.id,
        90,
        true,
      );
      c.intent = "seek";
      state.shooting = introductoryShooting(s, q, event.id);
      blockBusiness(s);
      e.status = "acknowledged";
      return;
    }
    if (claim !== "blocks" && claim !== "unaffiliated") return; // Authored follow-up, no second lie.
    note(
      claim === "blocks"
        ? "Quanny nods. “I know you Big BB. What you got?”"
        : "Quanny: “You don’t bang. Alright. What you got?”",
    );
    state.business = "open";
    revealQuannyLocation(s);
    return;
  }
  if (["explain", "decline-details"].includes(choice)) {
    if (choice === "explain") {
      const sponsor = s.danger.recognition.find(
        (r) =>
          r.subject === p.id &&
          r.source === "sponsorship" &&
          r.affiliation === p.affiliation,
      );
      note(
        sponsor
          ? `You name ${s.characters[sponsor.observer].name}, who sponsored you.`
          : `You truthfully explain your membership in ${s.factions[p.affiliation!].name}; you don't invent a sponsor.`,
      );
    } else
      note(
        "You keep the details to yourself. Quanny: “Alright. What you got?”",
      );
    state.business = "open";
    revealQuannyLocation(s);
    return;
  }
  if (choice === "terms") return;
  if (choice === "front" || choice === "negotiate") {
    if (businessError(s)) return;
    if (choice === "negotiate" && p.skills.social < 60) {
      q.agency.unreasonableRequests++;
      note("Quanny: “That ain’t worth my time. Bring a real proposal.”");
      change(q, p.id, { trust: -6, respect: -4, grievance: 4 });
      if (q.agency.unreasonableRequests >= 3) blockBusiness(s);
    } else frontMerchandise(s, q.id, choice === "negotiate");
  } else if (choice === "collect") {
    const result = collectConsignment(s, q.id);
    if (result && !result.paid) {
      blockBusiness(s);
      addGrievance(
        s,
        p.id,
        q.id,
        "Quanny denied the consignment debt",
        result.eventId,
        40,
      );
      remember(
        s,
        q.id,
        p.id,
        result.eventId,
        "Refused their collection; dismissed their standing.",
        -8,
      );
    }
  } else if (choice === "repair") {
    const event = note(
      repairError(s)
        ? "Quanny: “I need to see something real change.”"
        : "Quanny: “People been speaking on you. We can talk business again. That don’t settle everything.”",
    );
    state.repairHistory.push(event.id);
    if (!repairError(s)) {
      state.business = "open";
      change(q, p.id, { trust: 20, respect: 15, grievance: -15 });
    }
  } else if (["rob", "retaliate", "fight", "disrespect"].includes(choice)) {
    initiateConflict(
      s,
      q.id,
      choice as "rob" | "retaliate" | "fight" | "disrespect",
    );
  } else if (choice === "reconcile") {
    const event = note("You seek a mediated conversation about the dispute.");
    state.repairHistory.push(event.id);
    if (!repairError(s)) {
      for (const c of s.danger.conflicts.filter(
        (c) => c.participants.includes(q.id) && c.participants.includes(p.id),
      )) {
        c.state = "cooling";
        c.seriousness = Math.max(20, c.seriousness - 20);
        c.intent = "talk";
        c.updatedDay = s.day;
        c.history.push({
          eventId: event.id,
          day: s.day,
          outcome: "Credible mediation; grievances remain",
        });
      }
    }
  }
  e.status = "acknowledged";
}
/** A false Angels claim can be exposed by a real subsequent sponsorship witnessed by Quanny's contacts. */
export function advanceQuanny(s: GameState) {
  const q = s.characters.quanny;
  if (!q || q.status !== "active" || s.quanny.deception !== "unknown") return;
  const source = s.danger.recognition.find(
    (r) =>
      r.subject === s.playerId &&
      r.source === "sponsorship" &&
      r.affiliation !== "angels" &&
      q.connections.includes(r.observer) &&
      r.day >= (s.quanny.meetingDay ?? s.day),
  );
  if (!source) return;
  const e = record(
    s,
    "social",
    `A membership sponsor told Quanny who the player really runs with. He still remembers the rival claim and shooting.`,
    [q.id, source.observer],
    [q.id, source.observer],
  );
  s.quanny.deception = "known";
  s.quanny.history.push(e.id);
}
export function validateQuanny(s: GameState) {
  const q = s.quanny;
  if (
    (q.met &&
      (!q.meetingDay ||
        q.meetingDay > s.day ||
        !locationById(q.location ?? "") ||
        !s.characters.quanny)) ||
    (!q.met &&
      (q.claim !== null ||
        q.history.length > 0 ||
        q.knownLocation !== undefined)) ||
    ![...q.history, ...q.repairHistory].every((id) =>
      s.events.some((e) => e.id === id),
    )
  )
    throw new Error("Save contains invalid Quanny history.");
}
