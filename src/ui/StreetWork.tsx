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
    <section className="panel street-work" aria-label="Street operations">
      <p className="eyebrow">STREETS / CURRENT OPERATION</p>
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
            · ${lot.owed} still owed{lot.owed ? ` · due day ${lot.dueDay}` : ""}
          </p>
          <label>
            Transaction market{" "}
            <select
              aria-label="Transaction market"
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
            {s.zones[zone].name} · demand {m.demand} · pressure{" "}
            {Math.round(m.pressure)} · competition {m.competition}
          </p>
          <p>
            About ${unitPrice(s, zone)} each · up to{" "}
            {Math.min(lot.remaining, 2 + (m.demand >= 60 ? 1 : 0))} units ·{" "}
            {Math.round(transactionChance(s, p.id, zone) * 100)}% sale chance
          </p>
          <button disabled={!!reason} onClick={() => sell(zone)}>
            Pursue local transaction · 1 AP
          </button>
          {reason && <p className="disabled-reason">{reason}</p>}
        </>
      ) : (
        <button onClick={connects}>Find an arrangement in Connects →</button>
      )}
      <p className="muted">
        Heat: {heatDescription(p.police)} · Goods and cash can be lost. Police
        risk remains even when things seem quiet.
      </p>
    </section>
  );
}
