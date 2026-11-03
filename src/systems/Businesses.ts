import { clamp, player, type GameState } from "../core/GameState";
import { BUSINESSES } from "../content/strategy";
import { earn, expense } from "./Economy";
import { record } from "../core/EventLog";
import { random } from "../core/Random";
import { applyInfluence } from "./Territory";
export const operating = (status: string) =>
  ["operating", "profitable", "struggling"].includes(status);
export function businessError(
  s: GameState,
  id: string,
  action: "buy" | "maintain" | "sell" | "close",
) {
  const p = player(s),
    d = BUSINESSES.find((d) => d.id === id),
    b = s.strategic.businesses.find((b) => b.definition === id);
  if (!d) return "Unknown business opportunity";
  if (s.end || p.status !== "active" || s.ap < 1)
    return "Requires an active player and 1 AP";
  if (action === "buy") {
    if (b) return "This opportunity has already been acquired";
    if (p.legitimacy < d.legitimacy)
      return `Requires ${d.legitimacy} legitimacy`;
    if (p.wallet.clean + p.wallet.illicit < d.cost)
      return `Requires $${d.cost}`;
    if (
      s.street.arrears ||
      s.street.agreements.some((a) => a.balance > 0 && a.dueDay < s.day)
    )
      return "Resolve arrears and overdue obligations first";
  } else {
    if (!b || !operating(b.status)) return "Requires an operating business";
    if (action === "maintain" && p.wallet[b.provenance] < 120)
      return `Requires $120 ${b.provenance} funds`;
    if (
      action === "maintain" &&
      b.history.some(
        (h) => h.day === s.day && h.revenue === 0 && h.expenses === 120,
      )
    )
      return "Already maintained today";
  }
  return null;
}
export function businessAction(
  state: GameState,
  id: string,
  action: "buy" | "maintain" | "sell" | "close",
) {
  const error = businessError(state, id, action);
  if (error) return { state, error };
  const s = structuredClone(state),
    p = player(s),
    d = BUSINESSES.find((d) => d.id === id)!;
  s.ap--;
  if (action === "buy") {
    const paid = expense(s, p, d.cost, `Acquired ${d.name}`)!;
    const provenance = paid.illicit > 0 ? "illicit" : "clean",
      assetId = `business-${d.id}`;
    s.strategic.businesses.push({
      id: assetId,
      definition: d.id,
      acquiredDay: s.day,
      lastOperatingDay: s.day,
      status: "operating",
      provenance,
      condition: 85,
      lastNet: 0,
      totalNet: 0,
      profitableDays: 0,
      history: [],
    });
    s.assets.push({
      id: assetId,
      owner: p.id,
      value: Math.round(d.cost * 0.65),
      provenance,
      recurringIncome: 0,
    });
    record(
      s,
      "money",
      `Acquired ${d.name} for $${d.cost}. ${provenance === "clean" ? "Clean-funded asset; income must prove sustainable." : "Some funding was illicit: the entire asset, its proceeds and resale remain illicit and cannot qualify for retirement."}`,
      [p.id],
      [p.id],
      { title: "Business acquired", importance: "major" },
    );
  } else {
    const b = s.strategic.businesses.find((b) => b.definition === id)!,
      asset = s.assets.find((a) => a.id === b.id)!;
    if (action === "maintain") {
      // A clean-funded asset cannot be contaminated or magically cleaned by mixed upkeep.
      p.wallet[b.provenance] -= 120;
      s.ledger.push({
        day: s.day,
        amount: -120,
        provenance: b.provenance,
        reason: `Maintenance: ${d.name}`,
      });
      b.condition = clamp(b.condition + 30);
      asset.value = Math.round((d.cost * 0.65 * b.condition) / 100);
      b.totalNet -= 120;
      b.history.push({ day: s.day, revenue: 0, expenses: 120, net: -120 });
      updateBusinessIncome(s, b);
    } else {
      if (action === "sell")
        earn(s, p, asset.value, b.provenance, `Sold ${d.name}`);
      b.status = action === "sell" ? "sold" : "closed";
      asset.value = 0;
      asset.recurringIncome = 0;
      b.lastNet = 0;
    }
    record(
      s,
      "money",
      `${d.name}: ${action === "maintain" ? "maintenance paid ($120)" : action === "sell" ? "sold; operating income ended" : "closed; operating income ended"}.`,
      [p.id],
    );
  }
  return { state: s, error: null };
}
export function advanceBusinesses(s: GameState) {
  const p = player(s);
  for (const b of s.strategic.businesses.filter((b) => operating(b.status))) {
    if (b.lastOperatingDay >= s.day) continue;
    b.lastOperatingDay = s.day;
    const d = BUSINESSES.find((d) => d.id === b.definition)!,
      t = s.strategic.territories[d.zone],
      asset = s.assets.find((a) => a.id === b.id)!;
    b.condition = clamp(b.condition - 0.45 - (t.contested ? 0.15 : 0));
    const demand =
      0.45 + t.lawfulEconomy / 150 + (s.zones[d.zone].support - 40) / 250;
    const disruption =
      (t.contested ? 0.13 : 0) + (p.status === "arrested" ? 0.1 : 0);
    const revenue = Math.max(
      0,
      Math.round(
        d.revenue *
          demand *
          (0.35 + b.condition / 130) *
          (0.65 + random(s) * 0.7 - disruption),
      ),
    );
    const expenses = d.expenses + Math.round((100 - b.condition) * 0.12);
    // Gross income and expenses remain separately visible in the ledger. Losses create real arrears.
    earn(s, p, revenue, b.provenance, `${d.name}: operating revenue`);
    const covered = Math.min(p.wallet[b.provenance], expenses);
    p.wallet[b.provenance] -= covered;
    s.ledger.push({
      day: s.day,
      amount: -covered,
      provenance: b.provenance,
      reason: `${d.name}: operating expenses`,
    });
    if (covered < expenses) {
      s.street.arrears += expenses - covered;
      b.condition = clamp(b.condition - 5);
    }
    const net = revenue - expenses;
    b.lastNet = net;
    b.totalNet += net;
    b.profitableDays = net > 0 ? b.profitableDays + 1 : 0;
    b.history.push({ day: s.day, revenue, expenses, net });
    b.status = net > 0 ? "profitable" : "struggling";
    asset.value = Math.round((d.cost * 0.65 * b.condition) / 100);
    updateBusinessIncome(s, b);
    if (b.provenance === "clean" && net > 0) {
      applyInfluence(s, {
        actor: p.id,
        faction: null,
        zone: d.zone,
        kind: "economic",
        magnitude: Math.min(2, net / 30),
        cause: `${d.name} supported lawful local trade.`,
      });
      p.neighborhoodStanding[d.zone] = clamp(
        p.neighborhoodStanding[d.zone] + 0.15,
      );
      p.legitimacy = clamp(p.legitimacy + 0.1);
    }
    if (s.day % 7 === 0)
      record(
        s,
        "money",
        `${d.name}: $${revenue} revenue, $${expenses} expenses, ${net >= 0 ? "+" : ""}$${net} net today. Condition ${Math.round(b.condition)}%.`,
        [p.id],
      );
  }
}

function updateBusinessIncome(
  s: GameState,
  b: GameState["strategic"]["businesses"][number],
) {
  const asset = s.assets.find((a) => a.id === b.id)!;
  const recent = b.history.filter((h) => h.day > s.day - 14);
  asset.recurringIncome =
    b.lastOperatingDay - b.acquiredDay >= 14 &&
    new Set(recent.map((h) => h.day)).size >= 14
      ? Math.max(0, Math.floor(recent.reduce((n, h) => n + h.net, 0) / 14))
      : 0;
}
