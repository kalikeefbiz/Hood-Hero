import { player, type GameState } from "../core/GameState";
import { availableActions, type Action } from "../core/ActionEngine";
import { currentEmployment } from "../systems/Employment";
import { BUSINESSES } from "../content/strategy";
import { jobDefinition } from "../content/jobs";
import type { LocationDef } from "./locations";

// ---------------------------------------------------------------------------
// Place → existing systems. Everything here filters or reads what the game
// already offers; nothing creates new rules. Extend by adding `links` in
// locations.ts or a new branch below.
// ---------------------------------------------------------------------------

/** Existing actions that make sense at this place, in display order. */
export function placeActions(s: GameState, l: LocationDef): Action[] {
  const p = player(s),
    links = l.links,
    job = currentEmployment(s);
  const out: Action[] = [];
  for (const a of availableActions(s)) {
    if (links.job) {
      if (
        (a.type === "apply" || a.type === "acceptJob") &&
        a.jobId === links.job
      )
        out.push(a);
      if (
        job?.jobId === links.job &&
        (a.type === "work" || a.type === "timeOff" || a.type === "resign")
      )
        out.push(a);
    }
    if (
      links.items &&
      a.type === "buy" &&
      a.item &&
      links.items.includes(a.item)
    )
      out.push(a);
    if (links.gig && a.type === "gig") out.push(a);
    if (links.rest && a.type === "rest" && p.home === l.zone) out.push(a);
    if (
      links.incident &&
      a.incidentId === links.incident &&
      ["negotiate", "buyback", "recover"].includes(a.type)
    )
      out.push(a);
  }
  return out;
}

/** People who live in this place's district, known contacts first. */
export function placePeople(s: GameState, l: LocationDef) {
  if (!l.links.people) return [];
  const p = player(s);
  return Object.values(s.characters)
    .filter((c) => c.id !== p.id && c.home === l.zone && c.status !== "dead")
    .sort(
      (a, b) =>
        Number(p.known.includes(b.id)) - Number(p.known.includes(a.id)) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      name: c.alias ?? c.name,
      known: p.known.includes(c.id),
      affiliation: c.affiliation,
      trust: c.relationships[p.id]?.trust ?? 0,
    }));
}

/** Read-only facts about the place drawn from saved state. */
export function placeFacts(s: GameState, l: LocationDef): string[] {
  const facts: string[] = [];
  const job = currentEmployment(s);
  if (l.links.job) {
    const d = jobDefinition(l.links.job);
    facts.push(
      job?.jobId === l.links.job
        ? `You work here · $${job.wage} a shift`
        : `Hiring · ${d.name} · $${d.wage} a shift`,
    );
  }
  if (l.links.business) {
    const d = BUSINESSES.find((b) => b.id === l.links.business)!;
    const b = s.strategic.businesses.find(
      (b) => b.definition === d.id && !["sold", "closed"].includes(b.status),
    );
    facts.push(
      b
        ? `Owned by you · ${b.status} · last day ${b.lastNet >= 0 ? "+" : "−"}$${Math.abs(b.lastNet)}`
        : `Available · $${d.cost.toLocaleString()} · needs ${d.legitimacy} legitimacy`,
    );
  }
  if (l.links.incident) {
    const i = s.incidents[l.links.incident];
    if (i?.status === "active")
      facts.push(`Storyline: ${i.title} · demand $${i.demand}`);
  }
  if (l.links.rest && player(s).home === l.zone) facts.push("Your home turf");
  return facts;
}

/** True when the place has something the player can do right now. */
export const placeIsLive = (s: GameState, l: LocationDef) =>
  l.status === "live" &&
  (placeActions(s, l).length > 0 ||
    !!l.links.business ||
    !!l.links.street ||
    placePeople(s, l).length > 0 ||
    !!l.links.politics);
