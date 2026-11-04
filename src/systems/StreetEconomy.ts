import { applyInfluence } from "./Territory";
import { STRATEGY_BALANCE } from "../content/strategy";
import { arrest } from "./Incarceration";
import {
  cash,
  clamp,
  player,
  type GameState,
  type Character,
  type ZoneId,
} from "../core/GameState";
import { ZONES } from "../content/city";
import { MERCHANDISE, STREET_BALANCE as B } from "../content/street";
import type { StreetState, MerchandiseLot } from "./StreetTypes";
import { record } from "../core/EventLog";
import { random } from "../core/Random";
import { earn, expense } from "./Economy";
import { change, remember } from "./Relationships";
import { finishCommitment } from "./Commitments";
import {
  addExposure,
  exposureScore,
  transactionArrestChance,
} from "./CriminalExposure";
import { availability, cooperation } from "./CrewAgency";
export function newStreetState(): StreetState {
  return {
    lots: [],
    agreements: [],
    transactions: [],
    exposure: {},
    custody: [
      {
        id: "custody-loco",
        character: "loco",
        arrestDay: 0,
        cause: "Preexisting canonical incarceration",
        severity: 0,
        prior: 0,
        releaseDay: null,
        status: "held",
        conditions: "Indefinite; no automatic release",
        eventId: "",
      },
    ],
    arrears: 0,
    markets: Object.fromEntries(
      Object.values(ZONES).map((z) => [
        z.id,
        {
          zone: z.id,
          demand: z.commerce,
          pressure: 10,
          competition: z.organizations.length * 12,
          activity: 0,
          actors: {},
          factions: {},
          usedDay: 0,
          used: 0,
          lastDevelopmentDay: 0,
        },
      ]),
    ) as StreetState["markets"],
  };
}
export function suppliers(s: GameState) {
  // Reuse actual street contacts; lawful residents and Justice do not become dealers.
  return Object.values(s.characters)
    .filter(
      (c) =>
        c.id !== s.playerId &&
        !!c.affiliation &&
        c.traits.lawful < 65 &&
        c.status === "active",
    )
    .sort((a, b) => Number(a.id === "quanny") - Number(b.id === "quanny"));
}
export function marketAccess(
  s: GameState,
  actor: string,
  zone: ZoneId,
): string | null {
  const c = s.characters[actor];
  const controller = s.strategic.territories[zone].controller;
  if (
    controller &&
    c.affiliation &&
    s.factions[controller].enemies.includes(c.affiliation) &&
    c.neighborhoodStanding[zone] < 25
  )
    return "Rival control restricts market access; requires 25 local standing";
  const local = suppliers(s).some(
    (n) =>
      n.home === zone &&
      c.connections.includes(n.id) &&
      (n.relationships[actor]?.trust ?? 0) >= B.trust,
  );
  const connectedCrew =
    actor === s.playerId &&
    s.crew.members.some((id) => {
      const m = s.characters[id];
      const participating =
        m.status === "active" &&
        s.assignments.some(
          (a) =>
            a.status === "active" &&
            a.activity === "partner-crime" &&
            a.member === id &&
            a.participants.includes(actor),
        );
      return (
        (participating ||
          (!availability(s, m) &&
            cooperation(s, m, "partner-crime").accepted)) &&
        m.known.some(
          (n) =>
            s.characters[n]?.home === zone &&
            s.characters[n]?.affiliation &&
            c.connections.includes(n) &&
            (s.characters[n].relationships[actor]?.trust ?? 0) >= 10,
        )
      );
    });
  if (zone === "downtown")
    return c.neighborhoodStanding.downtown >= B.downtownStanding &&
      c.connections.some((id) => s.characters[id]?.home === zone) &&
      c.skills.social >= 50
      ? null
      : "Downtown needs 15 local standing, a local contact and practiced connections (50 social).";
  return local ||
    connectedCrew ||
    c.neighborhoodStanding[zone] >= 10 ||
    (c.affiliation &&
      s.zones[zone].organizations.includes(c.affiliation) &&
      c.organizationStanding[c.affiliation] >= 15)
    ? null
    : "Build trust with a local street contact or standing here. An unrelated contact does not open this market.";
}
export function supplierError(
  s: GameState,
  supplier: string,
  arrangement: "cash" | "consignment",
) {
  const p = player(s),
    n = s.characters[supplier];
  if (s.end || p.status !== "active")
    return "Street work is unavailable while in custody or after the run ends.";
  if (s.ap < 1) return "Requires 1 AP to accept merchandise.";
  if (
    !n ||
    !suppliers(s).some((c) => c.id === supplier) ||
    !p.connections.includes(supplier)
  )
    return "Meet an eligible supplier first.";
  if (n.availableDay > s.day) return "Supplier is committed elsewhere today.";
  if ((n.relationships[p.id]?.trust ?? 0) < B.trust)
    return "Supplier requires at least 20 trust. Spend time together first.";
  if (
    p.affiliation &&
    n.affiliation &&
    s.factions[n.affiliation].enemies.includes(p.affiliation)
  )
    return "Conflicting affiliations close this arrangement.";
  if (s.street.agreements.some((a) => a.debtor === p.id && a.balance > 0))
    return "Settle your existing supplier balance before taking another lot.";
  if (s.street.lots.some((l) => l.owner === p.id && l.remaining > 0))
    return "Finish distributing your current lot first.";
  const last = s.street.lots.filter((l) => l.owner === p.id).at(-1);
  if (last && s.day < last.acquiredDay + B.resupplyDays)
    return `Next limited supply from day ${last.acquiredDay + B.resupplyDays}.`;
  if ((n.relationships[p.id]?.grievance ?? 0) > 40)
    return "Repair this supplier relationship before asking for more.";
  if (
    exposureScore(s, p.id, n.home) > B.supplierExposure ||
    n.police > B.supplierExposure
  )
    return "Too much scrutiny. Supplier is keeping their distance.";
  if (arrangement === "consignment" && (n.relationships[p.id]?.trust ?? 0) < 30)
    return "Consignment requires 30 supplier trust; cash terms start at 20.";
  if (
    n.affiliation &&
    s.factions[n.affiliation].resources < MERCHANDISE.nightgoods.wholesale
  )
    return "Supplier's organization has no stock budget today.";
  if (arrangement === "cash" && cash(p) < MERCHANDISE.nightgoods.wholesale)
    return "Requires $90 up front.";
  return null;
}
export function acquire(
  s: GameState,
  supplier: string,
  arrangement: "cash" | "consignment",
) {
  if (supplierError(s, supplier, arrangement)) return;
  const p = player(s),
    n = s.characters[supplier],
    def = MERCHANDISE.nightgoods;
  const cost = arrangement === "cash" ? def.wholesale : def.consignment;
  s.ap--;
  const paid =
    arrangement === "cash"
      ? expense(s, p, cost, `Night goods purchase · ${n.name}`)
      : null;
  if (paid) {
    n.wallet.clean += paid.clean;
    n.wallet.illicit += paid.illicit;
  }
  if (n.affiliation) s.factions[n.affiliation].resources -= def.wholesale;
  const lot: MerchandiseLot = {
    id: `lot-${s.nextId++}`,
    category: "nightgoods",
    owner: p.id,
    supplier,
    zone: n.home,
    received: def.quantity,
    remaining: def.quantity,
    lost: 0,
    cost,
    expectedGross: def.quantity * unitPrice(s, n.home),
    collected: 0,
    owed: arrangement === "consignment" ? cost : 0,
    paid: arrangement === "cash" ? cost : 0,
    losses: 0,
    crewPaid: 0,
    dueDay: s.day + B.deadline,
    acquiredDay: s.day,
    arrangement,
    status: "held",
  };
  s.street.lots.push(lot);
  const e = record(
    s,
    "money",
    `${n.name} supplied ${def.quantity} night goods. ${arrangement === "cash" ? `$${cost} paid up front.` : `$${cost} owed by the end of day ${lot.dueDay}.`} Expected gross $${lot.expectedGross} is an estimate, not income.`,
    [p.id, n.id],
    [p.id, n.id],
    {
      importance: "major",
      title: "Supplier arrangement",
      factionId: n.affiliation ?? undefined,
    },
  );
  if (arrangement === "consignment") {
    const commitmentId = `commitment-${s.nextId++}`,
      id = `agreement-${s.nextId++}`;
    lot.agreementId = id;
    s.street.agreements.push({
      id,
      lotId: lot.id,
      supplier,
      debtor: p.id,
      original: cost,
      repaid: 0,
      balance: cost,
      dueDay: lot.dueDay,
      status: "pending",
      commitmentId,
      history: [e.id],
    });
    s.commitments.push({
      id: commitmentId,
      origin: lot.id,
      requester: supplier,
      actor: p.id,
      beneficiary: supplier,
      createdDay: s.day,
      dueDay: lot.dueDay,
      kind: "supplier-debt",
      status: "pending",
      evidence: [e.id],
      warned: false,
      consequences: {
        fulfilled: { trust: 7, respect: 4, grievance: -4 },
        broken: {
          trust: -(8 + Math.floor(n.traits.ambition / 10)),
          respect: -5,
          grievance: 10 + Math.floor(n.traits.risk / 10),
        },
        released: { trust: 0, respect: 0, grievance: 0 },
      },
    });
  }
  remember(s, n.id, p.id, e.id, "Entrusted with a limited merchandise lot.", 0);
}
export function unitPrice(s: GameState, zone: ZoneId) {
  const m = s.street.markets[zone];
  return Math.max(
    30,
    Math.round(
      MERCHANDISE.nightgoods.unitPrice +
        (m.demand - 50) / 5 -
        m.pressure / 10 -
        m.competition / 12,
    ),
  );
}
export function saleLot(s: GameState, actor = s.playerId) {
  return s.street.lots.find((l) => l.owner === actor && l.remaining > 0);
}
export function saleMarket(s: GameState, actor = s.playerId) {
  const lot = saleLot(s, actor);
  return lot?.zone ?? s.characters[actor].home;
}
export function transactionError(
  s: GameState,
  actor = s.playerId,
  zone = saleMarket(s, actor),
) {
  const c = s.characters[actor];
  if (!c || c.status !== "active")
    return "Street actions require an active character.";
  if (actor === s.playerId && s.ap < 1) return "Requires 1 AP.";
  if (!saleLot(s, actor))
    return "No merchandise held. Arrange a limited lot with a supplier.";
  const access = marketAccess(s, actor, zone);
  if (access) return access;
  const m = s.street.markets[zone];
  if (m.usedDay === s.day && m.used >= B.marketDailyCapacity)
    return "Today's local demand is filled. Wait for another day.";
  if (
    s.street.transactions.filter((t) => t.actor === actor && t.day === s.day)
      .length >= B.transactionLimit
  )
    return "Today's opportunities are exhausted. Return tomorrow.";
  return null;
}
export function transactionChance(
  s: GameState,
  actor = s.playerId,
  zone = saleMarket(s, actor),
  partner?: string,
) {
  const c = s.characters[actor],
    m = s.street.markets[zone],
    n = partner ? s.characters[partner] : undefined;
  const support = n
    ? clamp(
        (n.skills.recovery - 35) / 300 +
          (n.relationships[actor]?.trust ?? 0) / 1200 -
          n.stress / 650 -
          n.police / 900,
        -0.16,
        0.16,
      )
    : 0;
  const conflict =
    c.affiliation &&
    s.zones[zone].organizations.some((f) =>
      s.factions[f].enemies.includes(c.affiliation!),
    )
      ? 0.12
      : 0;
  return clamp(
    B.baseSuccess +
      c.skills.recovery / 700 +
      support -
      exposureScore(s, actor, zone) / 220 -
      c.stress / 650 -
      m.pressure / 500 -
      (m.competition + (s.strategic.territories[zone].contested ? 10 : 0)) /
        900 -
      conflict,
    B.minSuccess,
    B.maxSuccess,
  );
}
export function transact(
  s: GameState,
  actor = s.playerId,
  zone = saleMarket(s, actor),
  partner?: string,
) {
  if (s.end || transactionError(s, actor, zone)) return;
  if (
    partner &&
    (!s.crew.members.includes(partner) ||
      s.characters[partner]?.status !== "active" ||
      !s.assignments.some(
        (a) =>
          a.status === "active" &&
          a.activity === "partner-crime" &&
          a.member === partner &&
          a.participants.includes(actor),
      ))
  )
    return;
  if (actor === s.playerId) s.ap--;
  else s.characters[actor].lastActionDay = s.day;
  const l = saleLot(s, actor)!,
    c = s.characters[actor],
    m = s.street.markets[zone];
  const policeChance = transactionArrestChance(s, actor, zone);
  const chance = transactionChance(s, actor, zone, partner),
    roll = random(s);
  if (m.usedDay !== s.day) {
    m.usedDay = s.day;
    m.used = 0;
  }
  const capacity = Math.min(
    l.remaining,
    2 + (m.demand >= 60 ? 1 : 0),
    B.marketDailyCapacity - m.used,
  );
  let sold = 0,
    lost = 0,
    loss = 0;
  let outcome: import("./StreetTypes").StreetTransaction["outcome"] = "none";
  if (roll < chance) {
    sold = roll < chance * 0.65 ? capacity : Math.max(1, capacity - 1);
    outcome = sold === capacity ? "sale" : "partial";
  } else {
    const failure = random(s);
    if (failure < 0.35) {
      lost = Math.min(l.remaining, 2);
      outcome = "goods-loss";
    } else if (failure < 0.65) {
      loss = Math.min(18, cash(c));
      outcome = "money-loss";
    }
  }
  const gross = sold * unitPrice(s, zone),
    share = partner ? Math.floor(gross * B.crewShare) : 0;
  l.remaining -= sold + lost;
  l.lost += lost;
  l.collected += gross;
  l.losses += loss;
  l.crewPaid += share;
  if (gross) earn(s, c, gross, "illicit", "Night goods transaction");
  if (loss) expense(s, c, loss, "Street transaction loss");
  const crewLoss =
    partner && loss ? Math.min(B.crewLoss, cash(s.characters[partner])) : 0;
  if (crewLoss)
    expense(s, s.characters[partner!], crewLoss, "Shared street loss");
  if (share) {
    const paid = expense(s, c, share, "Crew share of actual proceeds")!;
    const member = s.characters[partner!];
    member.wallet.clean += paid.clean;
    member.wallet.illicit += paid.illicit;
  }
  if (!l.remaining)
    l.status = l.owed ? (l.lost ? "lost" : "distributed") : "settled";
  m.used += capacity;
  m.activity += sold;
  m.pressure = clamp(m.pressure + 3 + lost * 2);
  m.actors[actor] = (m.actors[actor] ?? 0) + sold;
  if (c.affiliation) {
    m.factions[c.affiliation] = (m.factions[c.affiliation] ?? 0) + sold;
    s.factions[c.affiliation].resources = clamp(
      s.factions[c.affiliation].resources + Math.floor(gross * 0.05),
      0,
      STRATEGY_BALANCE.resourceCap,
    );
    if (sold)
      applyInfluence(s, {
        actor,
        faction: c.affiliation,
        zone,
        kind: "economic",
        magnitude: Math.min(1.5, sold * 0.15),
        cause: `${c.name}'s commerce contributed to ${s.factions[c.affiliation].name}'s economic presence.`,
      });
    if (actor === s.playerId)
      s.strategic.contributions[c.affiliation] += Math.min(3, gross * 0.01);
  }
  c.stress = clamp(c.stress + 7);
  c.rivalThreat = clamp(c.rivalThreat + 2 + m.competition / 25);
  const weight = lost
    ? B.goodsLossExposure
    : loss
      ? B.moneyLossExposure
      : sold
        ? B.actionExposure
        : B.noBuyerExposure;
  addExposure(s, actor, zone, weight);
  if (actor === s.playerId || partner === s.playerId)
    s.strategic.lastCrimeDay = s.day;
  if (partner) {
    const n = s.characters[partner];
    addExposure(s, partner, zone, weight * B.crewExposureShare, lost > 0);
    n.stress = clamp(n.stress + 7);
    n.rivalThreat = clamp(n.rivalThreat + 3);
  }
  const text = `${c.name} · ${s.zones[zone].name}: ${sold ? `${outcome === "partial" ? "Partial sale" : "Successful sale"}, ${sold} night goods for $${gross}.` : `Failed transaction. No proceeds.${lost ? ` ${lost} goods lost; supplier debt remains.` : loss ? ` $${loss} lost.` : " No buyer committed."}`} ${l.remaining} held.${partner ? ` ${s.characters[partner].name} participated; $${share} share from actual proceeds.` : ""}`;
  const e = record(
    s,
    "money",
    text,
    [actor, ...(partner ? [partner] : [])],
    [actor, ...(partner ? [partner] : [])],
    {
      importance: lost ? "personal" : "routine",
      factionId: c.affiliation ?? undefined,
    },
  );
  if (l.agreementId)
    s.street.agreements.find((a) => a.id === l.agreementId)!.history.push(e.id);
  if (!l.remaining && l.arrangement === "cash") {
    change(s.characters[l.supplier], actor, { trust: 2 });
    remember(s, l.supplier, actor, e.id, "Finished a cash-purchased lot.", 2);
  }
  s.street.transactions.push({
    id: `transaction-${s.nextId++}`,
    day: s.day,
    lotId: l.id,
    market: zone,
    actor,
    partner,
    sold,
    lost,
    gross,
    loss,
    crewPaid: share,
    crewLoss,
    outcome,
    eventId: e.id,
  });
  if (random(s) < policeChance)
    arrest(s, actor, "police intervention during street work", 1);
  if (partner && random(s) < transactionArrestChance(s, partner, zone))
    arrest(s, partner, "participating in street work", 1);
  return e;
}
export function paymentError(
  s: GameState,
  agreementId: string,
  amount: number,
) {
  const a = s.street.agreements.find((a) => a.id === agreementId);
  if (s.end || player(s).status !== "active")
    return "Repayment is unavailable in custody.";
  if (!a || a.debtor !== s.playerId || a.balance <= 0)
    return "No outstanding balance.";
  if (!s.characters[a.supplier] || s.characters[a.supplier].status !== "active")
    return "Supplier unavailable; the balance remains.";
  if (
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > a.balance ||
    cash(player(s)) < amount
  )
    return "Choose an affordable payment within the outstanding balance.";
  return null;
}
export function repay(s: GameState, agreementId: string, amount: number) {
  if (paymentError(s, agreementId, amount)) return;
  const a = s.street.agreements.find((a) => a.id === agreementId)!,
    l = s.street.lots.find((l) => l.id === a.lotId)!,
    n = s.characters[a.supplier];
  const paid = expense(s, player(s), amount, `Supplier repayment · ${n.name}`)!;
  n.wallet.clean += paid.clean;
  n.wallet.illicit += paid.illicit;
  a.repaid += amount;
  a.balance -= amount;
  l.owed = a.balance;
  l.paid += amount;
  const e = record(
    s,
    "money",
    `Paid ${n.name} $${amount}. $${a.balance} supplier balance remains.`,
    [s.playerId, n.id],
    undefined,
    { importance: "personal", commitmentId: a.commitmentId },
  );
  a.history.push(e.id);
  if (!a.balance) {
    const overdue = a.status === "overdue";
    a.status = "fulfilled";
    const promise = s.commitments.find((c) => c.id === a.commitmentId)!;
    if (overdue) {
      change(n, s.playerId, { trust: 5, grievance: -8 });
      remember(
        s,
        n.id,
        s.playerId,
        e.id,
        "Repaid late; the broken word is remembered.",
        3,
      );
    } else
      finishCommitment(s, promise, "fulfilled", a.history, {
        title: "Supplier paid",
        text: `${n.name}: “We're square. You kept your word.”`,
        memory: "Paid the merchandise balance on time.",
        weight: 7,
      });
    if (!l.remaining) l.status = "settled";
  }
}
export function advanceStreet(s: GameState) {
  for (const a of s.street.agreements) {
    // NPC debts are collected face to face; a missed player visit is not NPC refusal.
    if (
      a.debtor !== s.playerId ||
      a.status !== "pending" ||
      !a.balance ||
      s.day <= a.dueDay
    )
      continue;
    a.status = "overdue";
    const n = s.characters[a.supplier],
      p = s.characters[a.debtor];
    p.rivalThreat = clamp(p.rivalThreat + Math.min(10, n.traits.risk / 10));
    finishCommitment(
      s,
      s.commitments.find((c) => c.id === a.commitmentId)!,
      "broken",
      a.history,
      {
        title: `${n.name} is still owed`,
        text: `${n.name}: “Day ${a.dueDay} came and went. You still owe me $${a.balance}. Bring what you can. We're not doing more business till this is straight.”`,
        memory: "Missed supplier repayment; debt remains collectible.",
        weight: -12,
      },
    );
  }
  for (const m of Object.values(s.street.markets)) {
    m.pressure = Math.max(0, m.pressure - 2);
    // Real local actors and organization resources drive bounded autonomous market changes.
    const local = suppliers(s).filter(
      (c) =>
        c.home === m.zone && c.availableDay <= s.day && c.traits.risk >= 35,
    );
    const active = local[(s.day + local.length) % Math.max(1, local.length)];
    if (
      active &&
      s.day % 3 === 0 &&
      active.affiliation &&
      s.factions[active.affiliation].resources > 20
    ) {
      m.activity++;
      m.actors[active.id] = (m.actors[active.id] ?? 0) + 1;
      m.factions[active.affiliation] =
        (m.factions[active.affiliation] ?? 0) + 1;
      m.pressure = clamp(m.pressure + 4);
      m.competition = clamp(m.competition + 1, 0, 50);
      s.factions[active.affiliation].resources = clamp(
        s.factions[active.affiliation].resources + 2,
        0,
        STRATEGY_BALANCE.resourceCap,
      );
      m.demand = clamp(
        m.demand +
          (s.factions[active.affiliation].priority === "commerce" ? 1 : -1),
        25,
        95,
      );
      if (
        s.day - m.lastDevelopmentDay >= 9 &&
        player(s).known.includes(active.id) &&
        marketAccess(s, s.playerId, m.zone) === null
      ) {
        m.lastDevelopmentDay = s.day;
        record(
          s,
          "city",
          `${active.name}'s local trade raised competition in ${s.zones[m.zone].name}. Demand is now ${m.demand}; formal neighborhood control is unchanged.`,
          [active.id],
          [s.playerId],
          {
            importance: "personal",
            factionId: active.affiliation,
            title: "Local market shifted",
          },
        );
      }
    }
  }
}
export function lotProfit(l: MerchandiseLot) {
  return l.collected - l.cost - l.losses - l.crewPaid;
}
