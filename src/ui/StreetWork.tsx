import { copy } from "../content/copy";
import { useState } from "react";
import { player, type GameState, type ZoneId } from "../core/GameState";
import {
  saleLot,
  saleMarket,
  transactionError,
  transactionChance,
  unitPrice,
  marketAccess,
} from "../systems/StreetEconomy";
import { heatDescription } from "../systems/CriminalExposure";
export function StreetWork({
  s,
  sell,
  connects,
}: {
  s: GameState;
  sell: (zone: ZoneId) => void;
  connects: () => void;
}) {
  const [chosen, setChosen] = useState<ZoneId | null>(null);
  const p = player(s),
    lot = saleLot(s),
    zone = chosen ?? saleMarket(s),
    m = s.street.markets[zone],
    reason = transactionError(s, s.playerId, zone);
  return (
    <section
      className="panel street-work"
      aria-label={copy("interface.streetWork.streetOperations")}
    >
      <p className="eyebrow">
        {copy("interface.streetWork.streetsCURRENTOPERATION")}
      </p>
      <h3>
        {lot
          ? `${lot.remaining} night goods on hand`
          : "Nothing to move right now."}
      </h3>
      {lot ? (
        <>
          <p>
            {s.characters[lot.supplier].alias ??
              s.characters[lot.supplier].name}{" "}
            {copy("interface.streetWork.text")}
            {lot.owed}
            {copy("interface.streetWork.stillOwed")}
            {lot.owed ? ` · due day ${lot.dueDay}` : ""}
          </p>
          <label>
            {copy("interface.streetWork.transactionMarket")}{" "}
            <select
              aria-label={copy("interface.streetWork.transactionMarket2")}
              value={zone}
              onChange={(e) => setChosen(e.target.value as ZoneId)}
            >
              {Object.values(s.zones).map((z) => (
                <option
                  key={z.id}
                  value={z.id}
                  disabled={!!marketAccess(s, p.id, z.id)}
                >
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <p className="market-outlook">
            {s.zones[zone].name}
            {copy("interface.streetWork.demand")}
            {m.demand}
            {copy("interface.streetWork.pressure")} {Math.round(m.pressure)}
            {copy("interface.streetWork.competition")}
            {m.competition}
          </p>
          <p>
            {copy("interface.streetWork.about")}
            {unitPrice(s, zone)}
            {copy("interface.streetWork.eachUpTo")}{" "}
            {Math.min(lot.remaining, 2 + (m.demand >= 60 ? 1 : 0))}
            {copy("interface.streetWork.units")}{" "}
            {Math.round(transactionChance(s, p.id, zone) * 100)}
            {copy("interface.streetWork.saleChance")}
          </p>
          <button disabled={!!reason} onClick={() => sell(zone)}>
            {copy("interface.streetWork.pursueLocalTransaction1AP")}
          </button>
          {reason && <p className="disabled-reason">{reason}</p>}
        </>
      ) : (
        <button onClick={connects}>
          {copy("interface.streetWork.findAnArrangementInConnects")}
        </button>
      )}
      <p className="muted">
        {copy("interface.streetWork.heat")}
        {heatDescription(p.police)}
        {copy("interface.streetWork.goodsAndCashCanBeLostPolice")}
      </p>
    </section>
  );
}
