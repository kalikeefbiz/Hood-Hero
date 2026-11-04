import type { EncounterDefinition } from "../core/Encounter";
import { cash, player, type GameState } from "../core/GameState";
import { MERCHANDISE, STREET_BALANCE as B } from "./street";
import {
  paymentError,
  supplierError,
  unitPrice,
  suppliers,
} from "../systems/StreetEconomy";
export const SUPPLIER_ENCOUNTER: EncounterDefinition = {
  id: "street-supplier",
  type: "request",
  participants: [],
  priority: 80,
  trigger: () => [],
  eligible: (s, e) =>
    player(s).status === "active" &&
    !s.end &&
    s.characters[e.participants[0]]?.status === "active" &&
    player(s).connections.includes(e.participants[0]) &&
    !["closed", "acknowledged"].includes(e.status),
  expression: () => "proposing",
  dialogue: (s, e) => {
    const n = s.characters[e.participants[0]],
      a = s.street.agreements.find((a) => a.supplier === n.id && a.balance > 0);
    if (a)
      return `You still have $${a.balance} with me. ${a.status === "overdue" ? "It's late. I need you to start making this right." : `We said the end of day ${a.dueDay}.`} Losing the goods doesn't settle that. Bring what you can; I'll count every dollar.`;
    const tone =
      n.id === "mega"
        ? "Cuzzo, I'll put my name behind one small lot. Don't make me chase you."
        : n.id === "pablo"
          ? "You give your word, you keep it. I remember who does."
          : "Small lot. Clear terms. We see how this goes before there's any more.";
    return `${tone} ${MERCHANDISE.nightgoods.quantity} night goods: $90 cash now, or $102 on consignment by the end of day ${s.day + B.deadline}. Expected gross here is $${6 * unitPrice(s, n.home)} if it all sells. ${e.selectedResponses.some((r) => r.id === "terms") ? "That's gross, before supplier cost, losses and a partner's share. No guaranteed buyers. Police scrutiny, competition and repeated activity can interrupt trade; you still owe me if goods disappear." : "Buyers aren't promised. Police and local organizations are watching."}`;
  },
  responses: (s, e) => {
    const supplier = e.participants[0],
      a = s.street.agreements.find(
        (a) => a.supplier === supplier && a.balance > 0,
      );
    if (a)
      return [
        {
          id: "full",
          label: `Repay full balance · $${a.balance}`,
          detail: "0 AP · actual cash transferred",
          effect: {
            type: "street",
            choice: "repay",
            agreementId: a.id,
            amount: a.balance,
          },
          requirement: () => paymentError(s, a.id, a.balance),
        },
        {
          id: "partial",
          label: `Make partial payment · $${Math.min(25, a.balance)}`,
          detail: "0 AP · reduces remaining debt",
          effect: {
            type: "street",
            choice: "repay",
            agreementId: a.id,
            amount: Math.min(25, a.balance),
          },
          requirement: () => paymentError(s, a.id, Math.min(25, a.balance)),
        },
        {
          id: "affordable",
          label: `Pay what you can · $${Math.min(cash(player(s)), a.balance)}`,
          detail: "0 AP · leaves no cash cushion",
          effect: {
            type: "street",
            choice: "repay",
            agreementId: a.id,
            amount: Math.min(cash(player(s)), a.balance),
          },
          requirement: () =>
            paymentError(s, a.id, Math.min(cash(player(s)), a.balance)),
        },
        {
          id: "leave",
          label: "I'll come back.",
          effect: { type: "street", choice: "leave" },
        },
      ];
    return [
      {
        id: "cash",
        label: "Accept cash purchase · $90 · 1 AP",
        detail: "6 units · ownership transfers; no supplier debt",
        effect: {
          type: "street",
          choice: "acquire",
          supplier,
          arrangement: "cash",
        },
        requirement: () => supplierError(s, supplier, "cash"),
      },
      {
        id: "consignment",
        label: `Accept consignment · $102 due day ${s.day + B.deadline} · 1 AP`,
        detail: "6 units · personal repayment obligation, including losses",
        effect: {
          type: "street",
          choice: "acquire",
          supplier,
          arrangement: "consignment",
        },
        requirement: () => supplierError(s, supplier, "consignment"),
      },
      ...(!e.selectedResponses.some((r) => r.id === "terms")
        ? [
            {
              id: "terms",
              label: "Explain the terms and risk.",
              effect: { type: "street" as const, choice: "terms" },
            },
          ]
        : []),
      {
        id: "leave",
        label: "Decline. No arrangement.",
        effect: { type: "street", choice: "leave" },
      },
    ];
  },
  rules: { replay: "read-only", expiresWithIncident: false },
};
export function openSupplier(state: GameState, supplier: string): GameState {
  if (
    !suppliers(state).some((n) => n.id === supplier) ||
    !player(state).connections.includes(supplier) ||
    player(state).status !== "active" ||
    state.end
  )
    return state;
  const s = structuredClone(state);
  for (const e of s.encounters)
    if (e.status === "active") {
      e.status = "pending";
      e.deferred = true;
    }
  for (const e of s.encounters)
    if (
      e.definitionId === "street-supplier" &&
      ["active", "pending"].includes(e.status)
    )
      e.status = "closed";
  s.encounters.push({
    id: `street-conversation-${s.nextId++}`,
    definitionId: "street-supplier",
    participants: [supplier],
    createdDay: s.day,
    status: "active",
    selectedResponses: [],
    followUpPending: false,
    deferred: false,
  });
  return s;
}

export const SUPPLIER_REACTION: EncounterDefinition = {
  id: "street-reaction",
  type: "reaction",
  participants: [],
  priority: 45,
  trigger: (s) =>
    s.events
      .filter(
        (e) =>
          e.commitmentId &&
          s.commitments.some(
            (c) =>
              c.id === e.commitmentId &&
              c.kind === "supplier-debt" &&
              c.actor === s.playerId,
          ) &&
          ["major", "critical"].includes(e.importance ?? "") &&
          !s.acknowledgedEvents.includes(e.id),
      )
      .map((e) => ({ key: e.id, eventId: e.id })),
  eligible: (s, e) =>
    !s.acknowledgedEvents.includes(e.sourceEventId!) &&
    !["closed", "acknowledged"].includes(e.status),
  dialogue: (s, e) =>
    s.events.find((x) => x.id === e.sourceEventId)?.text ??
    "Your supplier remembers the arrangement.",
  responses: () => [
    {
      id: "acknowledge",
      label: "I hear you. Return to City.",
      effect: { type: "acknowledge" },
    },
  ],
  rules: { replay: "read-only", expiresWithIncident: false },
};
