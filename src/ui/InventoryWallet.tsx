import { copy } from "../content/copy";
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
        {copy("interface.inventoryWallet.supplier")}{" "}
        {s.characters[l.supplier].alias ?? s.characters[l.supplier].name}
        {copy("interface.inventoryWallet.text")} {s.zones[l.zone].name}
      </p>
      <p>
        {copy("interface.inventoryWallet.acquisition")}
        {money(l.cost)}
        {copy("interface.inventoryWallet.paid")}
        {money(l.paid)}
        {copy("interface.inventoryWallet.debt")} {money(l.owed)}
        {l.owed ? ` · due day ${l.dueDay}` : ""}
      </p>
      <p>
        {copy("interface.inventoryWallet.collected")}
        {money(l.collected)}
        {copy("interface.inventoryWallet.losses")}
        {money(l.losses)}
        {copy("interface.inventoryWallet.crewShare")} {money(l.crewPaid)}
      </p>
      <p>
        {l.remaining}
        {copy("interface.inventoryWallet.held")}
        {l.received}
        {copy("interface.inventoryWallet.received")}
        {l.lost}
        {copy("interface.inventoryWallet.lostResultAfterSupplierCost")}
        {money(lotProfit(l))}
        {l.remaining ? " (goods remain)" : ""}
      </p>
    </div>
  );
  return (
    <>
      <section
        className="panel inventory-panel"
        aria-label={copy("interface.inventoryWallet.inventory")}
      >
        <p className="eyebrow">{copy("interface.inventoryWallet.onHAND")}</p>
        <h3>{copy("interface.inventoryWallet.inventory2")}</h3>
        <div className="inventory-grid">
          {held.map((l) => (
            <details className="inventory-slot" data-lot={l.id} key={l.id}>
              <summary>
                <span className="item-placeholder" aria-hidden="true">
                  {copy("interface.inventoryWallet.text2")}
                </span>
                <strong>{copy("interface.inventoryWallet.nightGoods")}</strong>
                <b>
                  {copy("interface.inventoryWallet.text3")}
                  {l.remaining}
                </b>
                <small>
                  {copy("interface.inventoryWallet.viewLotDetails")}
                </small>
              </summary>
              {detail(l)}
            </details>
          ))}
          {!held.length && (
            <p className="empty-slot">
              {copy("interface.inventoryWallet.noMerchandiseOnHand")}
            </p>
          )}
        </div>
        {p.possessions.length > 0 && (
          <>
            <h4>{copy("interface.inventoryWallet.personalPossessions")}</h4>
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
        aria-label={copy("interface.inventoryWallet.outstandingObligations")}
      >
        <h3>{copy("interface.inventoryWallet.outstandingObligations2")}</h3>
        {debts.map((a) => (
          <div className="obligation-row" key={a.id}>
            <strong>
              {s.characters[a.supplier].alias ?? s.characters[a.supplier].name}{" "}
              {copy("interface.inventoryWallet.text4")}
              {money(a.balance)}
            </strong>
            <p>
              {copy("interface.inventoryWallet.dueEndOfDay")}
              {a.dueDay}
              {copy("interface.inventoryWallet.text5")}
              {a.status}
              {copy("interface.inventoryWallet.text6")}
              {money(a.repaid)}
              {copy("interface.inventoryWallet.repaid")}
            </p>
            <button
              disabled={
                p.status !== "active" ||
                s.characters[a.supplier].status !== "active"
              }
              onClick={() => open(a.supplier)}
            >
              {copy("interface.inventoryWallet.discussRepayment")}
            </button>
          </div>
        ))}
        {!debts.length && (
          <p>
            {copy("interface.inventoryWallet.noOutstandingSupplierBalance")}
          </p>
        )}
        <p className="muted">
          {copy("interface.inventoryWallet.unmetLivingExpenses")}
          {money(s.street.arrears)}
        </p>
      </section>
      <section
        className="panel transaction-history"
        aria-label={copy("interface.inventoryWallet.transactionHistory")}
      >
        <h3>{copy("interface.inventoryWallet.transactionHistory2")}</h3>
        {s.street.transactions
          .filter((t) => t.actor === p.id)
          .slice(-20)
          .reverse()
          .map((t) => (
            <p className="ledger" key={t.id}>
              {copy("interface.inventoryWallet.day")}
              {t.day}
              {copy("interface.inventoryWallet.text7")}
              {t.outcome}
              {copy("interface.inventoryWallet.text8")}
              {t.sold}
              {copy("interface.inventoryWallet.sold")}
              {t.lost}
              {copy("interface.inventoryWallet.lost")} {money(t.gross)}
              {copy("interface.inventoryWallet.gross")}
              {money(t.loss)}
              {copy("interface.inventoryWallet.loss")}
              {t.partner ? ` · with ${s.characters[t.partner].name}` : ""}
            </p>
          ))}
        {!s.street.transactions.some((t) => t.actor === p.id) && (
          <p>{copy("interface.inventoryWallet.noStreetTransactionsYet")}</p>
        )}
        <details>
          <summary>
            {copy("interface.inventoryWallet.supplierAndLotRecords")}
          </summary>
          {lots.map((l) => (
            <details key={l.id}>
              <summary>
                {copy("interface.inventoryWallet.nightGoodsDay")}
                {l.acquiredDay}
                {copy("interface.inventoryWallet.text9")}
                {l.status}
              </summary>
              {detail(l)}
            </details>
          ))}
          {s.street.agreements
            .filter((a) => a.debtor === p.id)
            .map((a) => (
              <p key={a.id}>
                {s.characters[a.supplier].name}
                {copy("interface.inventoryWallet.text10")}
                {a.status}
                {copy("interface.inventoryWallet.text11")} {money(a.balance)}
                {copy("interface.inventoryWallet.outstanding")}
                {money(a.original)}
                {copy("interface.inventoryWallet.agreed")}
              </p>
            ))}
        </details>
        <details>
          <summary>{copy("interface.inventoryWallet.custodyHistory")}</summary>
          {s.street.custody
            .filter((r) => r.character === p.id)
            .map((r) => (
              <p key={r.id}>
                {copy("interface.inventoryWallet.custodyRecord")}
                {r.status}
                {copy("interface.inventoryWallet.arrestDay")}
                {r.arrestDay}
                {copy("interface.inventoryWallet.releaseDay")}
                {r.releaseDay ?? "not defined"}
                {copy("interface.inventoryWallet.currentStatus")}
                {p.status}
              </p>
            ))}
        </details>
      </section>
    </>
  );
}
