import { useState } from "react";
import { player, type GameState, type ZoneId } from "../core/GameState";
import {
  suppliers,
  supplierError,
  saleLot,
  saleMarket,
  transactionError,
  transactionChance,
  lotProfit,
  unitPrice,
  marketAccess,
} from "../systems/StreetEconomy";
import { exposureScore, heatDescription } from "../systems/CriminalExposure";
import { money } from "./ActionCard";
export function StreetWork({
  s,
  open,
  sell,
  inventory = false,
}: {
  s: GameState;
  open: (id: string) => void;
  sell: (zone: ZoneId) => void;
  inventory?: boolean;
}) {
  const [chosen, setChosen] = useState<ZoneId | null>(null);
  const p = player(s),
    lot = saleLot(s),
    zone = chosen ?? saleMarket(s),
    reason = transactionError(s, s.playerId, zone);
  const contacts = suppliers(s).filter((n) => p.known.includes(n.id));
  const balances = s.street.agreements.filter((a) => a.debtor === p.id);
  return (
    <section
      className="panel street-work"
      aria-label={
        inventory ? "Inventory and supplier obligations" : "Street work"
      }
    >
      <p className="eyebrow">
        {inventory ? "GOODS & YOUR WORD" : "STREET WORK"}
      </p>
      <h3>
        {inventory
          ? "Inventory and supplier obligations"
          : "Limited lots. Real obligations."}
      </h3>
      <p>
        Night goods are fictional street merchandise. Receiving goods pays
        nothing. Buyers, losses, supplier cost and any crew share determine your
        profit.
      </p>
      <p>
        Heat: {heatDescription(p.police)} · {Math.round(p.police)} police
        attention · {Math.round(exposureScore(s, p.id, zone))} accumulated risk.
        Activity fades gradually.
      </p>
      {lot && (
        <p>
          <strong>{lot.remaining} night goods held</strong> ·{" "}
          {s.zones[lot.zone].name} · Supplier: {s.characters[lot.supplier].name}
        </p>
      )}
      {!inventory && (
        <>
          <label>
            Transaction market{" "}
            <select
              aria-label="Transaction market"
              value={zone}
              onChange={(e) => setChosen(e.target.value as ZoneId)}
            >
              {Object.values(s.zones).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!!reason} onClick={() => sell(zone)}>
            Pursue local transaction · 1 AP
          </button>
          <p className="muted">
            {reason ??
              `${s.zones[zone].name} · up to ${Math.min(lot!.remaining, 2 + (s.street.markets[zone].demand >= 60 ? 1 : 0))} units · about $${unitPrice(s, zone)}/unit · ${Math.round(transactionChance(s, s.playerId, zone) * 100)}% sale chance · goods, cash and police risk`}
          </p>
        </>
      )}
      {(!inventory || balances.some((a) => a.balance > 0)) && (
        <div className="street-contacts">
          <h4>
            {inventory
              ? "Talk about repayment"
              : "Supplier conversations · terms before accepting"}
          </h4>
          {!contacts.length && (
            <p>
              No supplier known. Reach out and ask for local introductions;
              lawful contacts may know somebody.
            </p>
          )}
          {contacts
            .filter(
              (n) =>
                !inventory ||
                balances.some((a) => a.supplier === n.id && a.balance > 0),
            )
            .map((n) => (
              <div className="memory" key={n.id}>
                <button
                  disabled={p.status !== "active"}
                  onClick={() => open(n.id)}
                >
                  Talk terms with {n.alias ?? n.name}
                </button>
                <p>
                  {s.zones[n.home].name} ·{" "}
                  {n.affiliation
                    ? s.factions[n.affiliation].name
                    : "Independent"}{" "}
                  · 6 units · $90 cash / $102 consignment · 1 AP ·{" "}
                  {supplierError(s, n.id, "cash") ??
                    "Cash arrangement eligible"}{" "}
                  ·{" "}
                  {supplierError(s, n.id, "consignment") ??
                    "Consignment eligible"}
                </p>
              </div>
            ))}
        </div>
      )}
      {!inventory && (
        <details>
          <summary>Local market access</summary>
          {Object.values(s.street.markets).map((m) => (
            <p key={m.zone}>
              {s.zones[m.zone].name}:{" "}
              {marketAccess(s, p.id, m.zone) ??
                `Open · demand ${m.demand} · pressure ${Math.round(m.pressure)} · competition ${Math.round(m.competition)}`}
            </p>
          ))}
        </details>
      )}
      {inventory && (
        <>
          <p>
            Unmet living expenses: <strong>{money(s.street.arrears)}</strong>.
            Recorded separately from supplier debt; cash never falls below zero.
          </p>
          {s.street.lots
            .filter((l) => l.owner === p.id)
            .map((l) => (
              <div className="memory" key={l.id}>
                <strong>Night goods · {l.status}</strong>
                <p>
                  {l.remaining}/{l.received} held · {l.lost} lost · Owner:{" "}
                  {p.name} · {s.zones[l.zone].name} ·{" "}
                  {s.characters[l.supplier].name}
                </p>
                <p>
                  Collected {money(l.collected)} · cost {money(l.cost)} · paid{" "}
                  {money(l.paid)} · owed {money(l.owed)} · due end of day{" "}
                  {l.dueDay}
                </p>
                <p>
                  Expected gross {money(l.expectedGross)} · losses{" "}
                  {money(l.losses)} · crew share {money(l.crewPaid)} · result
                  after full supplier cost {money(lotProfit(l))}
                  {l.remaining ? " (goods remain; not final)" : ""}
                </p>
              </div>
            ))}
          {!s.street.lots.length && <p>No merchandise owned.</p>}
          {balances.map((a) => (
            <p key={a.id}>
              <strong>
                {s.characters[a.supplier].name} · {a.status}
              </strong>{" "}
              · {money(a.balance)} outstanding / {money(a.original)} agreed ·{" "}
              {money(a.repaid)} repaid · due end of day {a.dueDay}
            </p>
          ))}
          <details>
            <summary>Transaction history</summary>
            {s.street.transactions
              .filter((t) => t.actor === p.id)
              .slice(-20)
              .reverse()
              .map((t) => (
                <p key={t.id}>
                  Day {t.day} · {t.outcome} · {t.sold} sold / {t.lost} lost ·{" "}
                  {money(t.gross)} gross / {money(t.loss)} loss
                  {t.partner ? ` · with ${s.characters[t.partner].name}` : ""}
                </p>
              ))}
          </details>
        </>
      )}
    </section>
  );
}
