import type { EncounterDefinition, EncounterResponse } from "../core/Encounter";
import {
  QUANNY_HOME,
  QUANNY_LOCATION_REVEAL,
  quannyCollectionInstruction,
} from "../systems/QuannyState";
import { presenceOf } from "../board/presence";
import { player } from "../core/GameState";
import { hospitalStay } from "../systems/Danger";
import { businessError, repairError } from "../systems/Quanny";
import { consignmentTerms, receivable } from "../systems/Consignment";
const response = (
  id: string,
  label: string,
  detail?: string,
  requirement?: EncounterResponse["requirement"],
): EncounterResponse => ({
  id,
  label,
  detail,
  requirement,
  effect: { type: "quanny", choice: id },
});
export const QUANNY_ENCOUNTER: EncounterDefinition = {
  id: "quanny",
  type: "request",
  participants: ["quanny"],
  priority: 100,
  trigger: () => [],
  eligible: (s, e) =>
    !s.end &&
    !hospitalStay(s) &&
    player(s).status === "active" &&
    s.characters.quanny?.status === "active" &&
    s.characters.quanny.availableDay <= s.day &&
    // Once a peaceful introduction is closed, resume business only at the revealed meeting place.
    (!e.deferred ||
      !s.quanny.knownLocation ||
      presenceOf(s).location === QUANNY_HOME) &&
    presenceOf(s).location ===
      (e.sourceEventId ? s.quanny.location : QUANNY_HOME),
  dialogue: (s, e) => {
    if (!s.quanny.claim) return "Aye, where you from?";
    if (s.quanny.business === "new")
      return "I ain’t never heard of you. Who put you on?";
    const a = receivable(s, "quanny");
    if (a)
      return `We got an arrangement. $${a.balance}. ${quannyCollectionInstruction(s, a.dueDay)}`;
    if (s.quanny.business === "blocked") return "What you coming around for?";
    if (e.selectedResponses.at(-1)?.id === "terms") {
      const t = consignmentTerms(s);
      return t
        ? `I can make some happen but I need a front. ${t.quantity} night goods. I owe you $${t.amount}, six days from now. I don't pay up front.`
        : "Bring something real before we talk business.";
    }
    return `${e.sourceEventId && s.quanny.knownLocation ? QUANNY_LOCATION_REVEAL + " " : ""}What you got?`;
  },
  responses: (s, e) => {
    const q = s.quanny,
      p = player(s);
    if (!q.claim) {
      const labels = {
        blocks: "This Big BB.",
        angels: "You see the wings, homie. Angels!",
        backstreet: "This BackStreet.",
        muds: "This MuddyWorld.",
        blips: "The Blips.",
      };
      return [
        response(
          `claim:${p.affiliation ?? "unaffiliated"}`,
          p.affiliation
            ? labels[p.affiliation]
            : "Ion bang, but Im trynna touch some money.",
          "Truthful affiliation",
        ),
        ...(["blocks", "angels"] as const)
          .filter((f) => f !== p.affiliation)
          .map((f) =>
            response(`claim:${f}`, labels[f], "False affiliation claim"),
          ),
      ];
    }
    if (q.business === "new")
      return [
        response("explain", "Explain your actual membership"),
        response("decline-details", "Keep the details to yourself"),
      ];
    const a = receivable(s, "quanny");
    if (a)
      return [
        response(
          "collect",
          `Collect $${a.balance}`,
          quannyCollectionInstruction(s, a.dueDay),
          (state) =>
            state.day < a.dueDay ? `Return on day ${a.dueDay}.` : null,
        ),
        response("leave", "Leave the arrangement in place"),
      ];
    const later = s.street.agreements.some(
      (a) =>
        a.debtor === "quanny" &&
        a.status === "disputed" &&
        a.collections!.some((c) => c.day < s.day),
    );
    const responses = [
      response(
        "terms",
        "Offer Quanny work",
        "Front real merchandise on consignment",
        (state) => businessError(state),
      ),
      response(
        "ask-work",
        "Ask Quanny for work · Locked",
        "“You need a body before we can talk about that.” Splash Gang paid violent work requires an established violent history; unavailable in this introduction.",
        () => "Future progression opportunity; contracts are not available.",
      ),
    ];
    if (e.selectedResponses.at(-1)?.id === "terms") {
      const t = consignmentTerms(s),
        n = consignmentTerms(s, true);
      responses.unshift(
        response(
          "front",
          `Agree · front ${t?.quantity ?? 0} goods for $${t?.amount ?? 0}`,
          "No up-front payment · six-day deadline",
          (state) => businessError(state),
        ),
        response(
          "negotiate",
          `Negotiate $${n?.amount ?? 0}`,
          "Practiced negotiation (60 social) makes a credible higher offer. Weak proposals damage the relationship.",
          (state) => businessError(state),
        ),
      );
    }
    if (q.business === "blocked")
      responses.push(
        response(
          "repair",
          "Discuss reopening business",
          "New credible ties or Blocc Boys progress required",
          (state) => repairError(state),
        ),
      );
    if (later && s.day > e.createdDay - 1)
      responses.push(
        response(
          "reconcile",
          "Seek reconciliation",
          "Credible social progress can cool a grievance; disputed debts remain.",
        ),
        response(
          "rob",
          "Attempt to rob Quanny",
          "Extreme danger · experienced Blocc Boys hitter with organizational backing",
        ),
        response(
          "retaliate",
          "Attempt violent retaliation",
          "Lethal danger · early players cannot eliminate him through a lucky roll",
        ),
        response(
          "fight",
          "Challenge Quanny to a fight",
          "Extreme danger · experience, skills, support and circumstances matter",
        ),
        response(
          "disrespect",
          "Publicly disrespect Quanny",
          "Creates lasting conflict memory",
        ),
      );
    responses.push(response("leave", "Leave it unresolved"));
    for (const r of responses)
      if (["rob", "retaliate", "fight", "disrespect"].includes(r.id)) {
        r.detail = `1 AP · ${r.detail}`;
        r.requirement = (state) => (state.ap < 1 ? "Requires 1 AP." : null);
      }
    return responses;
  },
  rules: { replay: "read-only", expiresWithIncident: false },
};
