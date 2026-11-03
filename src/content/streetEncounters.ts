import { copy } from "./copy";
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
      return copy("supplier-dialogue.reminder.dialogue", {
        amount: a.balance,
        terms:
          a.status === "overdue"
            ? copy("supplier-dialogue.reminder.overdue")
            : copy("supplier-dialogue.reminder.onTime", { deadline: a.dueDay }),
      });
    const tone =
      n.id === "mega"
        ? copy("supplier-dialogue.opening.mega")
        : n.id === "pablo"
          ? copy("supplier-dialogue.opening.pablo")
          : copy("supplier-dialogue.opening.other");
    return copy("supplier-dialogue.opening.dialogue", {
      tone: tone,
      quantity: MERCHANDISE.nightgoods.quantity,
      deadline: s.day + B.deadline,
      gross: 6 * unitPrice(s, n.home),
      risk: e.selectedResponses.some((r) => r.id === "terms")
        ? copy("supplier-dialogue.terms.expanded")
        : copy("supplier-dialogue.terms.brief"),
    });
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
          label: copy("supplier-dialogue.choices.fullPayment", {
            amount: a.balance,
          }),
          detail: copy("supplier-dialogue.details.fullPayment"),
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
          label: copy("supplier-dialogue.choices.partialPayment", {
            amount: Math.min(25, a.balance),
          }),
          detail: copy("supplier-dialogue.details.partialPayment"),
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
          label: copy("supplier-dialogue.choices.affordablePayment", {
            amount: Math.min(cash(player(s)), a.balance),
          }),
          detail: copy("supplier-dialogue.details.affordablePayment"),
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
          label: copy("supplier-dialogue.choices.returnLater"),
          effect: { type: "street", choice: "leave" },
        },
      ];
    return [
      {
        id: "cash",
        label: copy("supplier-dialogue.choices.cashPurchase"),
        detail: copy("supplier-dialogue.details.cashPurchase"),
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
        label: copy("supplier-dialogue.choices.consignment", {
          deadline: s.day + B.deadline,
        }),
        detail: copy("supplier-dialogue.details.consignment"),
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
              label: copy("supplier-dialogue.choices.explainTerms"),
              effect: { type: "street" as const, choice: "terms" },
            },
          ]
        : []),
      {
        id: "leave",
        label: copy("supplier-dialogue.choices.decline"),
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
            (c) => c.id === e.commitmentId && c.kind === "supplier-debt",
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
    copy("supplier-dialogue.reaction.fallback"),
  responses: () => [
    {
      id: "acknowledge",
      label: copy("supplier-dialogue.choices.acknowledge"),
      effect: { type: "acknowledge" },
    },
  ],
  rules: { replay: "read-only", expiresWithIncident: false },
};
