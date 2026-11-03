import { payArrears } from "../systems/Economy";
import { useState } from "react";
import { player, type GameState, type ZoneId } from "../core/GameState";
import { BUSINESSES, STRATEGY_BALANCE as B } from "../content/strategy";
import {
  businessAction,
  businessError,
  operating,
} from "../systems/Businesses";
import {
  POLITICAL_ACTIONS,
  politicalAction,
  politicalError,
  representative,
  type PoliticalAction,
  authorityStage,
  promotionRequirements,
  promote,
  successorError,
  appointSuccessor,
} from "../systems/Politics";
import { dominanceScore, stabilizedControl } from "../systems/Territory";
import {
  legitimateProgress,
  retire,
  finalizeEnding,
} from "../systems/EndConditions";
import { THEMES } from "./theme";
import "./strategy.css";
type Props = { s: GameState; onChange: (s: GameState) => void };
function useResult(onChange: Props["onChange"]) {
  const [message, setMessage] = useState("");
  return {
    message,
    apply: (result: { state: GameState; error: string | null }) => {
      if (result.error) setMessage(result.error);
      else {
        finalizeEnding(result.state);
        onChange(result.state);
        setMessage(result.state.events.at(-1)?.text ?? "Recorded.");
      }
    },
  };
}
export function NeighborhoodStrategy({
  s,
  zone,
  onChange,
}: Props & { zone: ZoneId }) {
  const t = s.strategic.territories[zone],
    p = player(s),
    contact = representative(s, zone),
    r = useResult(onChange);
  const meaningful = Object.entries(t.factions).filter(
    ([, q]) => q.presence >= 15 || q.economy >= 15,
  );
  return (
    <section
      className="strategy-neighborhood"
      aria-label="Neighborhood strategy"
    >
      <h4>{t.contested ? "Contested neighborhood" : "Neighborhood balance"}</h4>
      <p>
        {t.controller
          ? `Recognized control since day ${t.controlSince}: ${s.factions[t.controller].name}.`
          : "No organization has established recognized dominance."}{" "}
        {t.candidate &&
          `${s.factions[t.candidate].name} is consolidating a challenge (${t.candidateDays}/${B.stabilizationDays} days).`}
      </p>
      <p className="muted">
        Civilian climate {Math.round(s.zones[zone].support)}/100 · Lawful
        economy {Math.round(t.lawfulEconomy)}/100.{" "}
        {t.contested
          ? "Rival pressure increases market risk and reduces local trade."
          : "Local trade faces ordinary competition."}
      </p>
      {meaningful.map(([id, q]) => (
        <div
          className="foothold"
          key={id}
          style={{ borderLeftColor: THEMES[id as keyof typeof THEMES].accent }}
        >
          <strong>{s.factions[id as keyof typeof s.factions].name}</strong>
          <div
            className="power-track"
            role="meter"
            aria-label={`${s.factions[id as keyof typeof s.factions].name} relative influence`}
            aria-valuenow={Math.round(
              dominanceScore(s, zone, id as keyof typeof s.factions),
            )}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i
              style={{
                width: `${dominanceScore(s, zone, id as keyof typeof s.factions)}%`,
                background: THEMES[id as keyof typeof THEMES].accent,
              }}
            />
          </div>
          <small>
            Presence {Math.round(q.presence)} · Economy {Math.round(q.economy)}{" "}
            · Support {Math.round(q.support)} · Pressure{" "}
            {Math.round(q.pressure)}
          </small>
        </div>
      ))}
      {!meaningful.length && (
        <p>
          No substantial faction foothold. Commerce alone does not establish
          territorial control.
        </p>
      )}
      {t.changes.slice(-2).map((c) => (
        <p className="memory" key={c.eventId}>
          Day {c.day}:{" "}
          {c.to
            ? s.factions[c.to].name + " gained control"
            : "Recognized control lost"}
          .
        </p>
      ))}
      <details className="strategic-actions">
        <summary>Influence this neighborhood</summary>
        <p className="muted">
          One investment every {B.actionCooldown} days.{" "}
          {contact
            ? `Work through ${s.characters[contact].name}.`
            : "Organizational actions require an accessible, trusted representative."}
        </p>
        {(Object.keys(POLITICAL_ACTIONS) as PoliticalAction[]).map((type) => {
          const a = POLITICAL_ACTIONS[type],
            error = politicalError(s, type, zone, contact);
          return (
            <div className="strategy-action" key={type}>
              <button
                disabled={!!error}
                onClick={() => r.apply(politicalAction(s, type, zone, contact))}
              >
                {a.label} · ${a.cost} · 1 AP
              </button>
              {error && <small>{error}</small>}
            </div>
          );
        })}
      </details>
      {r.message && <p role="status">{r.message}</p>}
      <details>
        <summary>Recent faction decisions</summary>
        {Object.values(s.factions).map((f) => {
          const plan = s.strategic.strategies[f.id],
            last = plan.history.filter((h) => h.zone === zone).at(-1);
          return last ? (
            <p key={f.id}>
              Day {last.day} · {f.name}: {last.kind} · ${last.cost} committed.
            </p>
          ) : null;
        })}
      </details>
    </section>
  );
}
export function OrganizationPanel({ s, onChange }: Props) {
  const p = player(s),
    r = useResult(onChange),
    stage = authorityStage(s),
    next = promotionRequirements(s),
    f = p.affiliation ? s.factions[p.affiliation] : null;
  return (
    <section
      className="panel organization-panel"
      aria-label="Organizational progression"
    >
      <p className="eyebrow">POWER & SUCCESSION</p>
      <h3>{f ? f.name : "Unaffiliated"}</h3>
      <p>
        {f
          ? `${stage?.name ?? "Member"} · Authority ${p.authority} · Standing ${Math.round(p.organizationStanding[f.id])} · Credited contributions $${Math.floor(s.strategic.contributions[f.id])}`
          : "A personal Set does not own territory. Build trust with connected members and earn sponsorship in Connects."}
      </p>
      {f && (
        <>
          <p>
            {stage?.permission}.{" "}
            {f.leaders.length
              ? `Established leadership: ${f.leaders.map((id) => s.characters[id].name + " (" + s.characters[id].status + ")").join(", ")}.`
              : "The organization retains its existing authority structure."}
          </p>
          {next.stage && (
            <>
              <h4>Next: {next.stage.name}</h4>
              <ul>
                {next.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <button
                disabled={
                  !!s.end ||
                  p.status !== "active" ||
                  !!next.missing.length ||
                  s.ap < 1
                }
                onClick={() => r.apply(promote(s))}
              >
                Request advancement · 1 AP
              </button>
            </>
          )}
          <p>
            Underlord: {stabilizedControl(s, f.id)}/4 stabilized neighborhoods ·{" "}
            {Math.min(70, p.authority)}/70 authority ·{" "}
            {s.crew.successor
              ? `Appointed: ${s.characters[s.crew.successor].name}`
              : "Successor not appointed"}
            .
          </p>
        </>
      )}
      <details>
        <summary>Successor eligibility</summary>
        <p>
          Requires council authority, shared affiliation, 60 trust, 60 loyalty
          and availability.
        </p>
        {s.crew.members.map((id) => {
          const error = successorError(s, id);
          return (
            <div className="strategy-action" key={id}>
              <strong>{s.characters[id].name}</strong>
              <small>{error ?? "Eligible to accept succession"}</small>
              <button
                disabled={
                  !!error || s.ap < 1 || !!s.end || p.status !== "active"
                }
                onClick={() => r.apply(appointSuccessor(s, id))}
              >
                Appoint {s.characters[id].alias ?? s.characters[id].name} · 1 AP
              </button>
            </div>
          );
        })}
      </details>
      {r.message && <p role="status">{r.message}</p>}
    </section>
  );
}
export function BusinessPanel({ s, onChange }: Props) {
  const r = useResult(onChange);
  return (
    <section
      className="panel business-panel"
      aria-label="Legitimate businesses"
    >
      <p className="eyebrow">OWN A PIECE OF THE CITY</p>
      <h3>Business opportunities</h3>
      <p className="muted">
        Acquisition uses actual cash, clean first. Any illicit funding makes the
        asset, all income and resale illicit. Net income fluctuates; maintenance
        costs $120. Sale value replaces the asset and never counts twice.
      </p>
      {BUSINESSES.map((d) => {
        const b = s.strategic.businesses.find((b) => b.definition === d.id),
          a = b ? s.assets.find((a) => a.id === b.id) : null;
        const actions = b
          ? operating(b.status)
            ? (["maintain", "sell", "close"] as const)
            : []
          : (["buy"] as const);
        return (
          <article className="business-opportunity" key={d.id}>
            <h4>{d.name}</h4>
            <p>
              {s.zones[d.zone].name} ·{" "}
              {b ? b.status : `Available · $${d.cost.toLocaleString()}`}
            </p>
            <p className="muted">
              {d.description} Base daily revenue ${d.revenue}, expenses $
              {d.expenses}; actual results depend on conditions.
            </p>
            {b && (
              <p>
                Funding: {b.provenance} · Condition {Math.round(b.condition)}% ·
                Latest net ${b.lastNet} · Lifetime net ${b.totalNet} · Asset
                value ${a?.value ?? 0} · Proven recurring net $
                {a?.recurringIncome ?? 0}/day
              </p>
            )}
            {actions.map((action) => {
              const error = businessError(s, d.id, action);
              return (
                <div className="strategy-action" key={action}>
                  <button
                    disabled={!!error}
                    onClick={() => r.apply(businessAction(s, d.id, action))}
                  >
                    {action === "buy"
                      ? "Acquire"
                      : action === "maintain"
                        ? "Maintain · $120"
                        : action === "sell"
                          ? `Sell · $${a?.value}`
                          : "Close"}{" "}
                    {d.name} · 1 AP
                  </button>
                  {error && <small>{error}</small>}
                </div>
              );
            })}
            {b && (
              <details>
                <summary>Operating history</summary>
                {b.history
                  .slice(-7)
                  .reverse()
                  .map((h, i) => (
                    <p key={i}>
                      Day {h.day} · ${h.revenue} revenue − ${h.expenses}{" "}
                      expenses = ${h.net}
                    </p>
                  ))}
              </details>
            )}
          </article>
        );
      })}
      {r.message && <p role="status">{r.message}</p>}
    </section>
  );
}
export function RetirementPanel({ s, onChange }: Props) {
  const r = useResult(onChange),
    v = legitimateProgress(s);
  return (
    <section
      className="panel retirement-panel"
      aria-label="Legitimate Exit progress"
    >
      <p className="eyebrow">A LIFE OF YOUR OWN</p>
      <h3>Legitimate Exit</h3>
      {s.street.arrears > 0 && (
        <button
          disabled={
            !!s.end ||
            player(s).status !== "active" ||
            player(s).wallet.clean + player(s).wallet.illicit < s.street.arrears
          }
          onClick={() => r.apply(payArrears(s))}
        >
          Clear arrears · ${s.street.arrears}
        </button>
      )}
      <p>
        Qualifying net wealth ${Math.floor(v.wealth).toLocaleString()} /
        $100,000 · Proven recurring net ${v.income}/day / $24 · Sustainable days{" "}
        {s.strategic.lawfulStreak}/{B.lawfulSustainDays}
      </p>
      <ul>
        {v.missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {!v.missing.length && <p>You qualify. Retirement is your decision.</p>}
      <button
        disabled={!!s.end || !!v.missing.length}
        onClick={() => r.apply(retire(s))}
      >
        Retire voluntarily
      </button>
      {r.message && <p role="status">{r.message}</p>}
    </section>
  );
}
