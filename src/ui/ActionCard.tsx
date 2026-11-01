import {
  ACTIONS,
  actionSuccessChance,
  validateAction,
  type Action,
} from "../core/ActionEngine";
import type { GameState } from "../core/GameState";
import { ITEMS } from "../content/economy";
import { Scene } from "./Scene";
import { BALANCE } from "../content/balance";
import { Icon } from "./Icon";
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const labels = {
  work: "Clock in",
  gig: "Pick up a gig",
  affiliate: "Get put on",
};
export function ActionCard({
  s,
  action: a,
  onAction,
  compact = false,
}: {
  s: GameState;
  action: Action;
  onAction: (a: Action) => void;
  compact?: boolean;
}) {
  const chance = actionSuccessChance(s, a);
  const def = ACTIONS[a.type],
    reason = validateAction(s, a);
  const cost =
    a.type === "buy"
      ? ITEMS[a.item!].price
      : a.type === "buyback"
        ? s.incidents[a.incidentId!].demand
        : a.type === "offer"
          ? 20
          : a.type === "transfer"
            ? 25
            : 0;
  const title =
    a.type === "buy"
      ? ITEMS[a.item!].name
      : a.type === "buyback"
        ? `Buy back · ${money(cost)}`
        : (labels[a.type as keyof typeof labels] ?? def.label);
  const identity = `${a.type}-${a.target ?? a.item ?? "default"}`;
  const zone =
    a.type === "work"
      ? "downtown"
      : a.target
        ? s.characters[a.target].home
        : s.characters[a.actor].home;
  const brief =
    a.type === "work"
      ? `$${BALANCE.workIncome} clean. Full shift.`
      : a.type === "gig"
        ? `$${BALANCE.gigIncome} clean. Local work.`
        : a.target
          ? `Check in with ${s.characters[a.target].alias ?? s.characters[a.target].name}.`
          : def.description;
  if (compact)
    return (
      <article
        className={`action-card action-tile tile-${a.type} ${reason ? "unavailable" : ""}`}
      >
        <div className="tile-art">
          <Scene zone={zone} eager />
          <span className="tile-symbol">
            <Icon
              name={
                a.type === "work"
                  ? "cash"
                  : a.type === "gig"
                    ? "Finances"
                    : "People"
              }
            />
          </span>
          <span className="tile-ap">{def.ap} AP</span>
        </div>
        <div className="tile-copy">
          <h3>{title}</h3>
          {reason ? (
            <p className="disabled-reason" id={`${identity}-reason`}>
              {reason}
            </p>
          ) : (
            <p>{brief}</p>
          )}
          <small className="risk">
            {def.risk === "None" ? "NO RISK" : `${def.risk.toUpperCase()} RISK`}
          </small>
        </div>
        <div className="tile-controls">
          <button
            disabled={!!reason}
            aria-describedby={reason ? `${identity}-reason` : undefined}
            onClick={() => onAction(a)}
          >
            <span>{reason ? "Unavailable" : "Go"}</span>
            <Icon name="arrow" />
          </button>
          <details className="tile-details">
            <summary>Outcomes</summary>
            <small>
              {def.description} {def.outcomes.join(" / ")}
            </small>
          </details>
        </div>
      </article>
    );
  return (
    <article
      className={`action-card ${a.type === "buy" ? "purchase-ticket" : "illustrated-action"} ${def.risk === "High" ? "danger" : ""}`}
    >
      {a.type !== "buy" && (
        <div className="action-illustration">
          <Scene zone={zone} />
          <span className="action-plate">
            <Icon
              name={
                a.type === "work" ? "cash" : a.target ? "People" : "Actions"
              }
            />
          </span>
        </div>
      )}
      <div className="action-top">
        <span className="ap-cost">
          {def.ap} AP{cost ? ` · ${money(cost)}` : ""}
        </span>
        <span className={`risk ${def.risk === "High" ? "high" : ""}`}>
          {def.risk === "None" ? "NO RISK" : `${def.risk.toUpperCase()} RISK`}
        </span>
      </div>
      <h3>{title}</h3>
      {a.type in labels && (
        <small className="action-definition">{def.label}</small>
      )}
      {a.target && (
        <p className="action-target">
          With {s.characters[a.target].alias ?? s.characters[a.target].name}
        </p>
      )}
      <p>{a.type === "buy" ? ITEMS[a.item!].description : def.description}</p>
      {chance !== null && (
        <p className="chance">
          Success chance <strong>{Math.round(chance * 100)}%</strong>
          <small>
            Based on current skills, stress
            {a.type === "recover"
              ? ", escalation and available Set support"
              : ""}
            .
          </small>
        </p>
      )}
      <small className="outcome">
        {a.type === "buy"
          ? `−${ITEMS[a.item!].relief} stress`
          : def.outcomes.join(" / ")}
      </small>
      <button
        disabled={!!reason}
        aria-describedby={reason ? `${identity}-reason` : undefined}
        onClick={() => onAction(a)}
      >
        {reason ? "Unavailable" : "Take action"}
        <Icon name="arrow" />
      </button>
      {reason && (
        <p className="disabled-reason" id={`${identity}-reason`}>
          {reason}
        </p>
      )}
    </article>
  );
}
