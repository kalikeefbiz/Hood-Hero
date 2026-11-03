import { player, type GameState } from "../core/GameState";
import { lotProfit } from "../systems/StreetEconomy";
import { ITEMS } from "../content/economy";
import { money } from "./ActionCard";
import { Icon } from "./Icon";
export function InventoryWallet({
  s,
  open,
}: {
  s: GameState;
  open: (id: string) => void;
}) {
  const p = player(s),
    lots = s.street.lots.filter((l) => l.owner === p.id),
    held = lots.filter((l) => l.remaining > 0),
    debts = s.street.agreements.filter(
      (a) => a.debtor === p.id && a.balance > 0,
    );
  const detail = (l: (typeof lots)[number]) => (
    <div className="lot-details">
      <p>
        Supplier:{" "}
        {s.characters[l.supplier].alias ?? s.characters[l.supplier].name} ·{" "}
        {s.zones[l.zone].name}
      </p>
      <p>
        Acquisition {money(l.cost)} · paid {money(l.paid)} · debt{" "}
        {money(l.owed)}
        {l.owed ? ` · due day ${l.dueDay}` : ""}
      </p>
      <p>
        Collected {money(l.collected)} · losses {money(l.losses)} · crew share{" "}
        {money(l.crewPaid)}
      </p>
      <p>
        {l.remaining} held / {l.received} received · {l.lost} lost · result
        after supplier cost {money(lotProfit(l))}
        {l.remaining ? " (goods remain)" : ""}
      </p>
    </div>
  );
  return (
    <>
      <section className="panel inventory-panel" aria-label="Inventory">
        <p className="eyebrow">ON HAND</p>
        <h3>Inventory</h3>
        <div className="inventory-grid">
          {held.map((l) => (
            <details className="inventory-slot" data-lot={l.id} key={l.id}>
              <summary>
                <span className="item-placeholder" aria-hidden="true">
                  ▧
                </span>
                <strong>Night goods</strong>
                <b>×{l.remaining}</b>
                <small>View lot details</small>
              </summary>
              {detail(l)}
            </details>
          ))}
          {!held.length && (
            <p className="empty-slot">No merchandise on hand.</p>
          )}
        </div>
        {p.possessions.length > 0 && (
          <>
            <h4>Personal possessions</h4>
            <div className="possession-grid">
              {p.possessions.map((id) => (
                <span className="possession-slot" key={id}>
                  <Icon name="People" />
                  {ITEMS[id as keyof typeof ITEMS]?.name ?? id}
                </span>
              ))}
            </div>
          </>
        )}
      </section>
      <section
        className="panel obligations-panel"
        aria-label="Outstanding obligations"
      >
        <h3>Outstanding obligations</h3>
        {debts.map((a) => (
          <div className="obligation-row" key={a.id}>
            <strong>
              {s.characters[a.supplier].alias ?? s.characters[a.supplier].name}{" "}
              · {money(a.balance)}
            </strong>
            <p>
              Due end of day {a.dueDay} · {a.status} · {money(a.repaid)} repaid
            </p>
            <button
              disabled={
                p.status !== "active" ||
                s.characters[a.supplier].status !== "active"
              }
              onClick={() => open(a.supplier)}
            >
              Discuss repayment
            </button>
          </div>
        ))}
        {!debts.length && <p>No outstanding supplier balance.</p>}
        <p className="muted">
          Unmet living expenses: {money(s.street.arrears)}
        </p>
      </section>
      <section
        className="panel transaction-history"
        aria-label="Transaction history"
      >
        <h3>Transaction history</h3>
        {s.street.transactions
          .filter((t) => t.actor === p.id)
          .slice(-20)
          .reverse()
          .map((t) => (
            <p className="ledger" key={t.id}>
              Day {t.day} · {t.outcome} · {t.sold} sold / {t.lost} lost ·{" "}
              {money(t.gross)} gross / {money(t.loss)} loss
              {t.partner ? ` · with ${s.characters[t.partner].name}` : ""}
            </p>
          ))}
        {!s.street.transactions.some((t) => t.actor === p.id) && (
          <p>No street transactions yet.</p>
        )}
        <details>
          <summary>Supplier and lot records</summary>
          {lots.map((l) => (
            <details key={l.id}>
              <summary>
                Night goods · day {l.acquiredDay} · {l.status}
              </summary>
              {detail(l)}
            </details>
          ))}
          {s.street.agreements
            .filter((a) => a.debtor === p.id)
            .map((a) => (
              <p key={a.id}>
                {s.characters[a.supplier].name} · {a.status} ·{" "}
                {money(a.balance)} outstanding / {money(a.original)} agreed
              </p>
            ))}
        </details>
        <details>
          <summary>Custody history</summary>
          {s.street.custody
            .filter((r) => r.character === p.id)
            .map((r) => (
              <p key={r.id}>
                Custody record · {r.status} · arrest day {r.arrestDay} · release
                day {r.releaseDay ?? "not defined"} · current status: {p.status}
              </p>
            ))}
        </details>
      </section>
    </>
  );
}
