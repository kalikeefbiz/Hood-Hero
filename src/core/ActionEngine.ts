import { applyInfluence } from "../systems/Territory";
import { STRATEGY_BALANCE } from "../content/strategy";
import { finalizeEnding } from "../systems/EndConditions";
import {
  marketAccess,
  transactionError,
  transactionChance,
  transact,
} from "../systems/StreetEconomy";
import { addExposure } from "../systems/CriminalExposure";
import {
  cash,
  clamp,
  player,
  type GameState,
  type GameEvent,
  type ID,
  type FactionId,
} from "./GameState";
import { record } from "./EventLog";
import { random } from "./Random";
import { BALANCE } from "../content/balance";
import { ITEMS, type ItemId } from "../content/economy";
import {
  change,
  remember,
  connect,
  contactError,
  introductionCandidates,
} from "../systems/Relationships";
import { earn, expense } from "../systems/Economy";
import { resolveIncident } from "../systems/Incidents";
import { syncEncounters } from "../systems/EncounterLifecycle";
import { evaluatePromises } from "../systems/Commitments";
import { requestActivity, requestError } from "../systems/CrewAgency";
import { recoverySupport } from "../systems/Crew";
import { progress } from "../systems/Progression";

import {
  currentEmployment,
  shiftToday,
  searchState,
  jobError,
  applyForJob,
  acceptJob,
  workShift,
  endEmployment,
  requestTimeOff,
  jobOpportunities,
} from "../systems/Employment";
export const ACTIONS = {
  apply: {
    label: "Apply for work",
    ap: 1,
    risk: "None",
    description:
      "Meet the hiring contact. Review the offer before accepting; no wages for applying.",
    outcomes: ["Job offer if eligible"],
  },
  acceptJob: {
    label: "Accept employment",
    ap: 0,
    risk: "None",
    description:
      "Commit to the repeating schedule. First shift is after today.",
    outcomes: ["Persistent employment and scheduled shifts"],
  },
  timeOff: {
    label: "Request unpaid time off",
    ap: 0,
    risk: "None",
    description:
      "Ask to be excused from today's shift. One approved leave per seven days.",
    outcomes: ["No absence, no wages"],
  },
  resign: {
    label: "Resign from work",
    ap: 0,
    risk: "None",
    description:
      "End employment and future obligations. Applications pause for three days; same workplace for seven.",
    outcomes: ["Employment ends; employer trust falls"],
  },
  contact: {
    label: "Reach out",
    ap: 1,
    risk: "None",
    description: "Make contact and establish a little trust.",
    outcomes: ["Trust and shared memories"],
  },
  inquire: {
    label: "Ask around",
    ap: 1,
    risk: "None",
    description: "Learn about people and the property dispute.",
    outcomes: ["Information and new contacts"],
  },
  introduce: {
    label: "Ask for an introduction",
    ap: 1,
    risk: "None",
    description: "Meet the people this contact knows.",
    outcomes: ["New known contacts"],
  },
  socialize: {
    label: "Spend time together",
    ap: 1,
    risk: "None",
    description: "Build trust, shaped by their values.",
    outcomes: ["Trust, respect and stress relief"],
  },
  favor: {
    label: "Request help",
    ap: 1,
    risk: "Social",
    description: "Ask a trusted person to support the dispute.",
    outcomes: ["Support from a trusted contact"],
  },
  offer: {
    label: "Offer support · $20",
    ap: 1,
    risk: "None",
    description: "Give financial support. Its provenance stays with the money.",
    outcomes: ["Money transferred and trust built"],
  },
  transfer: {
    label: "Transfer $25",
    ap: 1,
    risk: "None",
    description: "Send $25 to this person.",
    outcomes: ["Money transferred"],
  },
  negotiate: {
    label: "Negotiate buyback",
    ap: 1,
    risk: "Social",
    description: "Try to lower the group’s demand, once per dispute.",
    outcomes: ["Lower demand or refusal"],
  },
  settlement: {
    label: "Discuss settlement",
    ap: 1,
    risk: "Social",
    description: "Tell active leadership about the unauthorized incident.",
    outcomes: ["Leadership may intervene on a later day"],
  },
  buyback: {
    label: "Pay for the chains",
    ap: 1,
    risk: "None",
    description:
      "Meet the current demand and return the property to its owner.",
    outcomes: ["Property returned; cash paid to the group"],
  },
  recover: {
    label: "Attempt property recovery",
    ap: 2,
    risk: "High",
    description:
      "An abstract, uncertain operation. Failure raises exposure and conflict.",
    outcomes: ["Property returned or police and rival pressure"],
  },
  work: {
    label: "Work a full shift",
    ap: 2,
    risk: "None",
    description:
      "Attend your scheduled shift. Build work skills and legitimacy. Requires an active job and today’s obligation.",
    outcomes: ["$96 clean income; +8 stress"],
  },
  gig: {
    label: "Take a local gig",
    ap: 1,
    risk: "None",
    description:
      "Earn $38 helping a local business in your neighborhood. One ordinary gig per day; no recurring obligation.",
    outcomes: ["$38 clean income; +3 stress"],
  },
  crime: {
    label: "Street work transaction",
    ap: 1,
    risk: "High",
    description:
      "Distribute merchandise you actually hold through a limited local market. Supplier balances remain owed.",
    outcomes: [
      "Actual sales or loss; inventory, supplier debt and exposure persist",
    ],
  },
  buy: {
    label: "Buy item",
    ap: 1,
    risk: "None",
    description: "Buy a personal item and reduce stress.",
    outcomes: ["Cash spent; stress relieved"],
  },
  recruit: {
    label: "Invite to your Set",
    ap: 1,
    risk: "Social",
    description: "Requires free capacity, trust and willingness.",
    outcomes: ["Persistent crew membership"],
  },
  remove: {
    label: "Remove from Set",
    ap: 1,
    risk: "Social",
    description: "Part ways. Identity and relationship history remain.",
    outcomes: ["Member leaves; trust falls"],
  },
  assign: {
    label: "Assign a paid errand",
    ap: 1,
    risk: "Low",
    description:
      "Reserve an available member for a lawful errand due next day.",
    outcomes: [
      "$24 clean income and member experience, or a failed obligation",
    ],
  },
  standing: {
    label: "Build a local connection",
    ap: 1,
    risk: "None",
    description:
      "Help a member’s neighborhood. Build personal and organizational standing.",
    outcomes: ["Standing, influence and legitimacy"],
  },
  affiliate: {
    label: "Request affiliation",
    ap: 1,
    risk: "Social",
    description: "A trusted member sponsors you when standing is sufficient.",
    outcomes: ["Membership in one established organization"],
  },
  rest: {
    label: "Take a quiet afternoon",
    ap: 1,
    risk: "None",
    description: "Relieve stress without spending money.",
    outcomes: ["−14 stress"],
  },
} as const;
export type ActionType = keyof typeof ACTIONS;
export interface Action {
  type: ActionType;
  actor: ID;
  target?: ID;
  incidentId?: ID;
  item?: ItemId;
  jobId?: ID;
  partner?: ID;
  market?: import("./GameState").ZoneId;
}
export function validateAction(s: GameState, a: Action): string | null {
  if (!ACTIONS[a.type]) return "Unknown action";
  const c = s.characters[a.actor],
    t = a.target ? s.characters[a.target] : undefined,
    i = a.incidentId ? s.incidents[a.incidentId] : undefined;
  if (!c) return "Unknown actor";
  if (s.end) return "This run has ended";
  if (c.status !== "active") return "Actor is not active";
  if (
    c.id === s.playerId
      ? s.ap < ACTIONS[a.type].ap
      : c.availableDay > s.day || c.lastActionDay >= s.day
  )
    return "Not enough AP or availability";
  if (["apply", "acceptJob"].includes(a.type)) {
    const error = jobError(s, a.actor, a.jobId);
    if (error) return error;
    const search = searchState(s, a.actor);
    if (a.type === "apply" && search.lastApplicationDay === s.day)
      return "One formal application per day. Review your offer.";
    if (a.type === "acceptJob" && search.offeredJob !== a.jobId)
      return "Apply and receive an offer first";
  }
  if (
    a.type === "work" &&
    (!currentEmployment(s, a.actor) || !shiftToday(s, a.actor))
  )
    return "No unfulfilled scheduled shift today. Formal employment is required.";
  if (["resign", "timeOff"].includes(a.type) && !currentEmployment(s, a.actor))
    return "You are not employed";
  if (a.type === "timeOff") {
    if (!shiftToday(s, a.actor)) return "No scheduled shift to excuse today";
    const last = currentEmployment(s, a.actor)!.timeOffDays.at(-1);
    if (last !== undefined && s.day - last < BALANCE.employment.timeOffInterval)
      return `Unpaid leave available again on day ${last + BALANCE.employment.timeOffInterval}`;
  }
  if (
    a.partner &&
    (!s.crew.members.includes(a.partner) ||
      !s.assignments.some(
        (x) =>
          x.status === "active" &&
          x.member === a.partner &&
          x.participants.includes(a.actor) &&
          x.activity === (a.type === "crime" ? "partner-crime" : "partner-gig"),
      ))
  )
    return "Partner participation requires an active shared assignment";
  if (a.type === "gig" && searchState(s, a.actor).lastGigDay === s.day)
    return "Today's local gig is complete. More opportunities tomorrow.";
  const targeted: ActionType[] = [
    "contact",
    "inquire",
    "introduce",
    "socialize",
    "favor",
    "offer",
    "transfer",
    "settlement",
    "recruit",
    "remove",
    "assign",
    "standing",
    "affiliate",
  ];
  if (targeted.includes(a.type) && (!t || t.id === c.id))
    return "Choose another person";
  if (t) {
    const storyAccess =
      a.type === "settlement" &&
      i?.status === "active" &&
      i.informed &&
      i.organization === t.affiliation;
    if (a.type !== "remove" && !storyAccess) {
      const error = contactError(s, c.id, t.id);
      if (error) return error;
      if (
        a.type === "socialize" &&
        (t.relationships[c.id]?.trust ?? 0) < 15 &&
        (t.relationships[c.id]?.affection ?? 0) < 15
      )
        return "Build a connection before inviting them to spend time together.";
      if (
        a.type === "introduce" &&
        !introductionCandidates(s, c.id, t.id).length
      )
        return "No appropriate new introduction is available through this contact.";
    }
    if (!c.known.includes(t.id)) return "You need an introduction";
    if (t.status !== "active" && a.type !== "remove")
      return "This person is unavailable";
  }
  const incidentActions: ActionType[] = [
    "negotiate",
    "settlement",
    "buyback",
    "recover",
    "favor",
  ];
  if (incidentActions.includes(a.type) && (!i || i.status !== "active"))
    return "No active property dispute";
  if (
    ["negotiate", "buyback", "recover", "settlement", "favor"].includes(
      a.type,
    ) &&
    !i?.informed
  )
    return "Speak to the victim or ask around first";
  if (a.type === "negotiate" && i?.negotiated)
    return "This demand has already been negotiated";
  if (
    a.type === "settlement" &&
    (!t?.affiliation ||
      t.affiliation !== i?.organization ||
      !s.factions[t.affiliation].leaders.includes(t.id))
  )
    return "Speak to active leadership of the organization";
  if (a.type === "settlement" && i?.leadershipAware)
    return "Leadership is already considering the dispute";
  if (
    a.type === "favor" &&
    (i?.helpRequested || (t?.relationships[c.id]?.trust ?? 0) < 45)
  )
    return "Help requires trust and can only be requested once";
  if (a.type === "buyback" && cash(c) < (i?.demand ?? Infinity))
    return "Insufficient cash for the current demand";
  if (
    (a.type === "offer" || a.type === "transfer") &&
    cash(c) < (a.type === "offer" ? 20 : 25)
  )
    return "Insufficient cash";
  if (a.type === "buy" && (!a.item || !ITEMS[a.item])) return "Choose an item";
  if (a.type === "buy" && a.item && cash(c) < ITEMS[a.item].price)
    return "Insufficient cash";
  if (
    a.type === "buy" &&
    a.item &&
    ["music", "clothing"].includes(a.item) &&
    c.possessions.includes(a.item)
  )
    return "Already owned";
  if (a.type === "crime") {
    if (a.market && !s.zones[a.market]) return "Unknown market";
    return transactionError(s, a.actor, a.market);
  }
  if (
    ["recruit", "remove", "assign", "affiliate"].includes(a.type) &&
    c.id !== s.playerId
  )
    return "Player Set action only";
  if (a.type === "assign")
    return "Use the member conversation to request cooperation";
  if (a.type === "recruit") {
    if (s.crew.members.includes(t!.id)) return "Already in your Set";
    if (s.crew.members.length >= s.crew.capacity)
      return "Your Set is at capacity";
    if (
      t!.availableDay > s.day ||
      (t!.relationships[c.id]?.trust ?? 0) < BALANCE.recruitTrust ||
      t!.traits.loyalty < 35
    )
      return "Requires an available person with at least 42 trust";
    if (
      t!.affiliation &&
      c.affiliation &&
      s.factions[t!.affiliation].enemies.includes(c.affiliation)
    )
      return "Conflicting organizational loyalty prevents recruitment";
  }
  if (["remove", "assign"].includes(a.type) && !s.crew.members.includes(t!.id))
    return "Not a member of your Set";
  if (a.type === "standing" && !t?.affiliation)
    return "Choose an organization member";
  if (a.type === "affiliate") {
    if (c.affiliation) return "Already affiliated";
    if (!t?.affiliation) return "A member must sponsor you";
    if (
      c.organizationStanding[t.affiliation] < BALANCE.affiliationStanding ||
      (t.relationships[c.id]?.trust ?? 0) < BALANCE.affiliationTrust
    )
      return "Requires 35 organizational standing and 35 sponsor trust";
  }
  return null;
}
// Shared with the interface so displayed odds use the resolver's exact current-state calculation.
// This does not validate eligibility or draw randomness.
export function actionSuccessChance(s: GameState, a: Action): number | null {
  const c = s.characters[a.actor];
  if (!c) return null;
  if (a.type === "negotiate")
    return clamp(0.35 + c.skills.social / 150 - c.stress / 500, 0.1, 0.85);
  if (a.type === "recover") {
    const i = a.incidentId ? s.incidents[a.incidentId] : undefined;
    return i
      ? clamp(
          0.22 +
            c.skills.recovery / 200 +
            recoverySupport(s, c.id, i.organization) -
            c.stress / 500 -
            i.escalation / 400,
          0.12,
          0.8,
        )
      : null;
  }
  if (a.type === "crime")
    return transactionChance(s, a.actor, a.market, a.partner);
  return null;
}
export function partnerContribution(s: GameState, id: string) {
  const c = s.characters[id],
    r = c.relationships[s.playerId];
  return clamp(
    (c.skills.recovery - 35) / 250 +
      (r?.trust ?? 0) / 1000 -
      c.stress / 600 -
      (r?.grievance ?? 0) / 500,
    -0.18,
    0.2,
  );
}
// Mutates only an owned simulation snapshot. UI calls performAction for transactional validation.
export function resolveAction(s: GameState, a: Action) {
  const c = s.characters[a.actor],
    t = a.target ? s.characters[a.target] : undefined,
    i = a.incidentId ? s.incidents[a.incidentId] : undefined;
  const successChance = actionSuccessChance(s, a);
  if (a.type === "crime") return transact(s, a.actor, a.market, a.partner);
  if (c.id === s.playerId) s.ap -= ACTIONS[a.type].ap;
  else {
    c.lastActionDay = s.day;
    if (["gig", "crime", "work"].includes(a.type))
      c.agency.lastAssignmentDay = s.day;
  }
  let text = "";
  let category: "social" | "money" | "crew" | "incident" | "risk" = "social";
  const socialGain = Math.max(3, 10 - Math.floor(c.stress / 25));
  switch (a.type) {
    case "apply":
      return applyForJob(s, a.actor, a.jobId!);
    case "acceptJob":
      return acceptJob(s, a.actor, a.jobId!);
    case "timeOff":
      return requestTimeOff(s, a.actor);
    case "resign":
      return endEmployment(s, currentEmployment(s, a.actor)!, false);
    case "work":
      return workShift(s, a.actor);
    case "contact":
    case "socialize": {
      const values = t!.traits.lawful > 60 && c.legitimacy > 20 ? 4 : 0;
      change(t!, c.id, {
        trust: socialGain + values,
        respect: 3,
        affection: 4,
      });
      change(c, t!.id, { trust: 5, affection: 3 });
      c.stress = clamp(c.stress - 4);
      c.skills.social = clamp(c.skills.social + 1);
      c.influence += 1;
      if (i && t!.id === i.victim) i.informed = true;
      text = `${c.name} spent time with ${t!.alias ?? t!.name}. Trust grew${values ? " — they value your legitimate work" : ""}.`;
      break;
    }
    case "inquire":
    case "introduce": {
      if (a.type === "introduce")
        for (const id of introductionCandidates(s, c.id, t!.id))
          connect(s, c.id, id);
      c.known = [...new Set([...c.known, ...t!.known])].filter(
        (id) => id !== c.id,
      );
      if (i) i.informed = true;
      change(t!, c.id, { trust: 4 });
      text = `${t!.name} ${a.type === "introduce" ? "made an appropriate introduction" : "shared what they know"}${i ? " and confirmed that the robbery was unauthorized. The property is held by the group, not a known individual" : ""}.`;
      break;
    }
    case "favor":
      i!.helpRequested = true;
      change(t!, c.id, { trust: 3 });
      text = `${t!.name} agreed to back your request for a peaceful settlement. Leadership still has to hear about it.`;
      break;
    case "offer":
    case "transfer": {
      const amount = a.type === "offer" ? 20 : 25,
        paid = expense(s, c, amount, `Support for ${t!.name}`)!;
      t!.wallet.clean += paid.clean;
      t!.wallet.illicit += paid.illicit;
      change(t!, c.id, { trust: a.type === "offer" ? 9 : 5, affection: 3 });
      text = `${c.name} sent $${amount} to ${t!.name}.`;
      category = "money";
      break;
    }
    case "negotiate":
      i!.negotiated = true;
      if (random(s) < successChance!) {
        i!.demand = Math.max(i!.minimumDemand, i!.demand - 30);
        text = `The group lowered its demand to $${i!.demand}.`;
      } else {
        text = "The group refused to lower the demand.";
        i!.escalation += 4;
      }
      category = "incident";
      break;
    case "settlement":
      i!.leadershipAware = true;
      change(t!, c.id, { respect: 4 });
      text = `${t!.name} learned of the unauthorized robbery. A leadership decision may follow as time passes.`;
      category = "incident";
      break;
    case "buyback": {
      const paid = expense(s, c, i!.demand, "Property buyback")!;
      // Group custody and group payment are retained; no invented individual holder.
      s.factions[i!.organization].resources = clamp(
        s.factions[i!.organization].resources + paid.clean + paid.illicit,
        0,
        STRATEGY_BALANCE.resourceCap,
      );
      resolveIncident(s, i!, "buyback", c.id);
      text = `${c.name} paid $${i!.demand} to settle the demand.`;
      category = "money";
      break;
    }
    case "recover": {
      addExposure(s, c.id, c.home, 18);
      c.notoriety = clamp(c.notoriety + 12);
      c.stress = clamp(c.stress + 16);
      c.rivalThreat = clamp(c.rivalThreat + 16);
      if (random(s) < successChance!) {
        resolveIncident(s, i!, "recovered", c.id);
        text = "The recovery succeeded. The exposure and resentment remain.";
      } else {
        i!.escalation = clamp(i!.escalation + 18);
        change(s.characters[i!.victim], c.id, { respect: 3 });
        text =
          "The recovery failed. Police attention and rival pressure increased; the dispute remains open.";
      }
      category = "risk";
      break;
    }
    case "gig": {
      c.neighborhoodStanding[c.home] = clamp(
        c.neighborhoodStanding[c.home] + 1,
      );
      const amount = BALANCE.gigIncome;
      (s.employmentSearch[c.id] ??= { eligibleDay: 1 }).lastGigDay = s.day;
      earn(s, c, amount, "clean", "Local gig");
      c.stress = clamp(c.stress + 3);
      c.legitimacy = clamp(c.legitimacy + 1);
      c.skills.work = clamp(c.skills.work + 1);
      c.influence += 1;
      c.neighborhoodStanding[c.home] = clamp(
        c.neighborhoodStanding[c.home] + 1,
      );
      if (c.id === s.playerId) s.progression.jobs++;
      text = `${c.name} earned $${amount} in lawful pay from today's local gig.`;
      category = "money";
      break;
    }
    case "buy": {
      const item = ITEMS[a.item!];
      expense(s, c, item.price, item.name);
      c.stress = clamp(c.stress - item.relief);
      c.possessions.push(a.item!);
      text = `${c.name} bought ${item.name.toLowerCase()} for $${item.price}.`;
      category = "money";
      break;
    }
    case "recruit":
      s.crew.members.push(t!.id);
      change(t!, c.id, { trust: 4, affection: 4 });
      text = `${t!.name} joined your personal Set. Their own loyalties and history remain.`;
      category = "crew";
      break;
    case "remove": {
      const promised = s.assignments.some(
        (a) => a.member === t!.id && ["accepted", "active"].includes(a.status),
      );
      const closeness = t!.relationships[c.id]?.affection ?? 0;
      s.crew.members = s.crew.members.filter((id) => id !== t!.id);
      if (s.crew.successor === t!.id) s.crew.successor = null;
      change(t!, c.id, {
        trust: -(10 + Math.round(closeness / 10) + (promised ? 6 : 0)),
        grievance: 4 + Math.round(closeness / 10) + (promised ? 4 : 0),
      });
      text = `${t!.name} left your Set. ${closeness >= 50 ? "Being cut out by someone close hurt; reconciliation can take time." : "There is distance between you now."} ${promised ? "Existing promises and their consequences remain." : "Your shared history remains."}`;
      category = "crew";
      break;
    }
    case "assign":
      return; // Legacy requests are rejected by validateAction.
    case "standing":
      c.organizationStanding[t!.affiliation!] = clamp(
        c.organizationStanding[t!.affiliation!] + 8,
      );
      c.neighborhoodStanding[t!.home] = clamp(
        c.neighborhoodStanding[t!.home] + 5,
      );
      c.influence += 3;
      c.legitimacy = clamp(c.legitimacy + 1);
      change(t!, c.id, { trust: 5, respect: 4 });
      text = `${c.name} strengthened a connection with ${s.factions[t!.affiliation!].name}.`;
      break;
    case "affiliate":
      c.affiliation = t!.affiliation as FactionId;
      c.authority = 10;
      if (c.id === s.playerId) s.strategic.membershipDay = s.day;
      change(t!, c.id, { respect: 5 });
      text = `${t!.name} sponsored ${c.name} into ${s.factions[c.affiliation].name}. Your Set remains a personal crew.`;
      break;
    case "rest":
      c.stress = clamp(c.stress - 14);
      text = `${c.name} took a quiet afternoon. Stress eased.`;
      break;
  }
  if (
    c.id === s.playerId &&
    ["standing", "offer", "socialize", "gig", "work"].includes(a.type)
  ) {
    const zone = t?.home ?? c.home;
    const faction = a.type === "standing" ? (t?.affiliation ?? null) : null;
    applyInfluence(s, {
      actor: c.id,
      participants: t ? [t.id] : [],
      faction,
      zone,
      kind:
        a.type === "gig"
          ? "economic"
          : a.type === "standing"
            ? "support"
            : "community",
      magnitude: a.type === "standing" ? 1.5 : 0.3,
      cause: `${c.name}'s ${a.type} activity supported local ${faction ? "organizational ties" : "civilian life"}.`,
    });
    if (c.id === s.playerId && faction && c.affiliation === faction)
      s.strategic.contributions[faction] += 2;
  }
  const e = record(
    s,
    category,
    text,
    [c.id, ...(t ? [t.id] : [])],
    [c.id, ...(t ? [t.id] : [])],
  );
  if (
    i &&
    ["negotiate", "settlement", "buyback", "recover", "favor"].includes(a.type)
  ) {
    i.interventions.push({
      actor: c.id,
      type:
        a.type === "recover" && i.resolution !== "recovered"
          ? "failed-recovery"
          : a.type,
      eventId: e.id,
      day: s.day,
    });
  }
  // During day advancement NPC actions happen before incident progression.
  // Only evaluate deadlines after the whole incident step, never mid-turn.
  evaluatePromises(s, false);
  if (t) {
    remember(
      s,
      t.id,
      c.id,
      e.id,
      a.type === "remove"
        ? "Removed me from the Set."
        : a.type === "offer"
          ? "Helped with money."
          : `We shared a ${a.type} interaction.`,
      a.type === "remove" ? -18 : 5,
    );
    remember(s, c.id, t.id, e.id, text, 5);
  }
  if (c.id === s.playerId) {
    progress(s);
    finalizeEnding(s);
  }
  return e;
}
export function performAction(
  state: GameState,
  a: Action,
): { state: GameState; error: string | null; event?: GameEvent } {
  const error = validateAction(state, a);
  if (error) return { state, error };
  const next = structuredClone(state);
  // Existing social action entry points route Set members through the same willingness/lifecycle.
  const crewActivity =
    a.type === "socialize"
      ? "social"
      : ["inquire", "introduce"].includes(a.type)
        ? "information"
        : null;
  if (
    a.actor === state.playerId &&
    a.target &&
    state.crew.members.includes(a.target) &&
    crewActivity
  ) {
    const error = requestError(state, a.target, crewActivity);
    if (error) return { state, error };
    requestActivity(next, a.target, crewActivity);
    progress(next);
    syncEncounters(next);
    return { state: next, error: null, event: next.events.at(-1) };
  }
  const previousAccess = Object.values(state.zones)
    .filter((z) => !marketAccess(state, state.playerId, z.id))
    .map((z) => z.id);
  const event = resolveAction(next, a);
  for (const z of Object.values(next.zones))
    if (
      !previousAccess.includes(z.id) &&
      !marketAccess(next, next.playerId, z.id)
    )
      record(
        next,
        "city",
        `Your local connections opened street work in ${z.name}. Check Actions for merchandise requirements, terms and risk.`,
        [next.playerId],
        [next.playerId],
        { importance: "personal", title: "New market access" },
      );
  progress(next);
  finalizeEnding(next);
  syncEncounters(next);
  return { state: next, error: null, event };
}
export function availableActions(s: GameState): Action[] {
  const p = player(s),
    incident = Object.values(s.incidents).find((i) => i.status === "active");
  const incidentId = incident?.id;
  const list: Action[] = (["work", "gig", "rest", "crime"] as ActionType[]).map(
    (type) => ({ type, actor: p.id }),
  );
  if (currentEmployment(s)) {
    list.push(
      { type: "timeOff", actor: p.id },
      { type: "resign", actor: p.id },
    );
  } else {
    for (const job of jobOpportunities(s))
      list.push({ type: "apply", actor: p.id, jobId: job.id });
    const offered = searchState(s, p.id).offeredJob;
    if (offered) list.push({ type: "acceptJob", actor: p.id, jobId: offered });
  }
  for (const item of Object.keys(ITEMS) as ItemId[])
    list.push({ type: "buy", actor: p.id, item });
  for (const target of p.known.filter((id) => id !== p.id && s.characters[id]))
    for (const type of [
      "contact",
      "inquire",
      "introduce",
      "socialize",
      "offer",
      "transfer",
      "standing",
      "affiliate",
      "recruit",
      "remove",
      "settlement",
      "favor",
    ] as ActionType[]) {
      if (!incident && (type === "settlement" || type === "favor")) continue;
      list.push({ type, actor: p.id, target, incidentId });
    }
  if (incident)
    for (const type of ["negotiate", "buyback", "recover"] as ActionType[])
      list.push({ type, actor: p.id, incidentId });
  const priority = (a: Action) =>
    a.type === "acceptJob" ? 2 : a.type === "apply" ? 1 : 0;
  return list.sort((a, b) => priority(b) - priority(a));
}
