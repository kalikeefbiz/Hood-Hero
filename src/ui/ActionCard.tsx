import {
  ACTIONS,
  actionSuccessChance,
  validateAction,
  type Action,
} from "../core/ActionEngine";
import type { GameState } from "../core/GameState";
import { ITEMS } from "../content/economy";
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
}: {
  s: GameState;
  action: Action;
  onAction: (a: Action) => void;
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
  return (
    <article className={`action-card ${def.risk === "High" ? "danger" : ""}`}>
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
