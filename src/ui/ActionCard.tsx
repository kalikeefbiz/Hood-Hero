import {
  ACTIONS,
  actionSuccessChance,
  validateAction,
  type Action,
} from "../core/ActionEngine";
import type { GameState } from "../core/GameState";
import { ITEMS } from "../content/economy";
import { ActionIllustration } from "./ActionIllustration";
import { ACTION_ART } from "./actionArt";
import { BALANCE } from "../content/balance";
import { Icon } from "./Icon";
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
import { currentEmployment } from "../systems/Employment";
import { jobDefinition, WEEKDAYS } from "../content/jobs";
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
  sharedReasonId,
}: {
  s: GameState;
  action: Action;
  onAction: (a: Action) => void;
  compact?: boolean;
  sharedReasonId?: string;
}) {
  const employment = currentEmployment(s);
  const job = a.jobId ? jobDefinition(a.jobId) : undefined;
  const employmentCopy =
    a.type === "work"
      ? `${employment ? `$${employment.wage} clean · ${jobDefinition(employment.jobId).name}` : "Employment required"}. Scheduled full shift · +8 stress.`
      : job
        ? `${job.description} $${job.wage} / shift · 2 AP · ${job.workdays.map((d) => WEEKDAYS[d]).join(" / ")} · ${s.zones[job.location].name}.`
        : null;
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
  const title = job
    ? `${a.type === "apply" ? "Apply" : "Accept"} · ${job.name}`
    : a.type === "buy"
      ? ITEMS[a.item!].name
      : a.type === "buyback"
        ? `Buy back · ${money(cost)}`
        : (labels[a.type as keyof typeof labels] ?? def.label);
  const identity = `${a.type}-${a.target ?? a.item ?? a.jobId ?? "default"}`;
  const hasArt = !!ACTION_ART[a.type];
  const brief =
    a.type === "work"
      ? employmentCopy!
      : a.type === "gig"
        ? `$${BALANCE.gigIncome} clean. Local work.`
        : a.target
          ? `Check in with ${s.characters[a.target].alias ?? s.characters[a.target].name}.`
          : def.description;
  if (compact)
    return (
      <article
        className={`action-card action-tile tile-${a.type} ${hasArt ? "has-action-art" : "neutral-action"} ${reason ? "unavailable" : ""}`}
        data-action={a.type}
      >
        <div className="tile-art">
          {hasArt && <ActionIllustration key={a.type} type={a.type} compact />}
          {!hasArt && (
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
          )}
          <span className="tile-ap">{def.ap} AP</span>
        </div>
        <div className="tile-copy">
          <h3>{title}</h3>
          <p>{brief}</p>
          {reason && !sharedReasonId && (
            <p className="disabled-reason" id={`${identity}-reason`}>
              {reason}
            </p>
          )}
          <small className="risk">
            {def.risk === "None" ? "NO RISK" : `${def.risk.toUpperCase()} RISK`}
          </small>
        </div>
        <div className="tile-controls">
          <button
            disabled={!!reason}
            aria-describedby={
              reason ? (sharedReasonId ?? `${identity}-reason`) : undefined
            }
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
      className={`action-card ${a.type === "buy" ? "purchase-ticket" : hasArt ? "illustrated-action" : "neutral-action"} ${def.risk === "High" ? "danger" : ""}`}
      data-action={a.type}
    >
      {hasArt && (
        <div className="action-illustration">
          <ActionIllustration key={a.type} type={a.type} />
          <span className="action-scene-caption" aria-hidden="true">
            STIXX CITY / EVERY MOVE MATTERS
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
      <p>
        {employmentCopy
          ? `${employmentCopy} ${def.description}`
          : a.type === "buy"
            ? ITEMS[a.item!].description
            : def.description}
      </p>
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
          : a.type === "work"
            ? "Scheduled wages; +1 work skill, +3 legitimacy, +8 stress"
            : def.outcomes.join(" / ")}
      </small>
      <button
        disabled={!!reason}
        aria-describedby={
          reason ? (sharedReasonId ?? `${identity}-reason`) : undefined
        }
        onClick={() => onAction(a)}
      >
        {reason ? "Unavailable" : "Take action"}
        <Icon name="arrow" />
      </button>
      {reason && !sharedReasonId && (
        <p className="disabled-reason" id={`${identity}-reason`}>
          {reason}
        </p>
      )}
    </article>
  );
}
