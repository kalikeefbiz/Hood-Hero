import { copy } from "../content/copy";
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
      aria-label={copy("interface.strategyPanels.neighborhoodStrategy")}
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
        {copy("interface.strategyPanels.civilianClimate")}
        {Math.round(s.zones[zone].support)}
        {copy("interface.strategyPanels.100LawfulEconomy")}
        {Math.round(t.lawfulEconomy)}
        {copy("interface.strategyPanels.100")}{" "}
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
            {copy("interface.strategyPanels.presence")}
            {Math.round(q.presence)}
            {copy("interface.strategyPanels.economy")}
            {Math.round(q.economy)} {copy("interface.strategyPanels.support")}
            {Math.round(q.support)}
            {copy("interface.strategyPanels.pressure")} {Math.round(q.pressure)}
          </small>
        </div>
      ))}
      {!meaningful.length && (
        <p>
          {copy(
            "interface.strategyPanels.noSubstantialFactionFootholdCommerceAloneDoes",
          )}
        </p>
      )}
      {t.changes.slice(-2).map((c) => (
        <p className="memory" key={c.eventId}>
          {copy("interface.strategyPanels.day")}
          {c.day}
          {copy("interface.strategyPanels.text")}{" "}
          {c.to
            ? s.factions[c.to].name + " gained control"
            : "Recognized control lost"}
          {copy("interface.strategyPanels.text2")}
        </p>
      ))}
      <details className="strategic-actions">
        <summary>
          {copy("interface.strategyPanels.influenceThisNeighborhood")}
        </summary>
        <p className="muted">
          {copy("interface.strategyPanels.oneInvestmentEvery")}
          {B.actionCooldown}
          {copy("interface.strategyPanels.days")}{" "}
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
                {a.label}
                {copy("interface.strategyPanels.text3")}
                {a.cost}
                {copy("interface.strategyPanels.1AP")}
              </button>
              {error && <small>{error}</small>}
            </div>
          );
        })}
      </details>
      {r.message && <p role="status">{r.message}</p>}
      <details>
        <summary>
          {copy("interface.strategyPanels.recentFactionDecisions")}
        </summary>
        {Object.values(s.factions).map((f) => {
          const plan = s.strategic.strategies[f.id],
            last = plan.history.filter((h) => h.zone === zone).at(-1);
          return last ? (
            <p key={f.id}>
              {copy("interface.strategyPanels.day2")}
              {last.day}
              {copy("interface.strategyPanels.text4")}
              {f.name}
              {copy("interface.strategyPanels.text5")}
              {last.kind}
              {copy("interface.strategyPanels.text6")}
              {last.cost}
              {copy("interface.strategyPanels.committed")}
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
      aria-label={copy("interface.strategyPanels.organizationalProgression")}
    >
      <p className="eyebrow">
        {copy("interface.strategyPanels.powerSUCCESSION")}
      </p>
      <h3>{f ? f.name : "Unaffiliated"}</h3>
      <p>
        {f
          ? `${stage?.name ?? "Member"} · Authority ${p.authority} · Standing ${Math.round(p.organizationStanding[f.id])} · Credited contributions $${Math.floor(s.strategic.contributions[f.id])}`
          : "A personal Set does not own territory. Build trust with connected members and earn sponsorship in Connects."}
      </p>
      {f && (
        <>
          <p>
            {stage?.permission}
            {copy("interface.strategyPanels.text7")}{" "}
            {f.leaders.length
              ? `Established leadership: ${f.leaders.map((id) => s.characters[id].name + " (" + s.characters[id].status + ")").join(", ")}.`
              : "The organization retains its existing authority structure."}
          </p>
          {next.stage && (
            <>
              <h4>
                {copy("interface.strategyPanels.next")}
                {next.stage.name}
              </h4>
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
                {copy("interface.strategyPanels.requestAdvancement1AP")}
              </button>
            </>
          )}
          <p>
            {copy("interface.strategyPanels.underlord")}
            {stabilizedControl(s, f.id)}
            {copy("interface.strategyPanels.4StabilizedNeighborhoods")}{" "}
            {Math.min(70, p.authority)}
            {copy("interface.strategyPanels.70Authority")}{" "}
            {s.crew.successor
              ? `Appointed: ${s.characters[s.crew.successor].name}`
              : "Successor not appointed"}
            {copy("interface.strategyPanels.text8")}
          </p>
        </>
      )}
      <details>
        <summary>
          {copy("interface.strategyPanels.successorEligibility")}
        </summary>
        <p>
          {copy(
            "interface.strategyPanels.requiresCouncilAuthoritySharedAffiliation60Trust",
          )}
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
                {copy("interface.strategyPanels.appoint")}
                {s.characters[id].alias ?? s.characters[id].name}
                {copy("interface.strategyPanels.1AP2")}
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
      aria-label={copy("interface.strategyPanels.legitimateBusinesses")}
    >
      <p className="eyebrow">
        {copy("interface.strategyPanels.ownAPIECEOFTHECITY")}
      </p>
      <h3>{copy("interface.strategyPanels.businessOpportunities")}</h3>
      <p className="muted">
        {copy(
          "interface.strategyPanels.acquisitionUsesActualCashCleanFirstAny",
        )}
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
              {s.zones[d.zone].name}
              {copy("interface.strategyPanels.text9")}{" "}
              {b ? b.status : `Available · $${d.cost.toLocaleString()}`}
            </p>
            <p className="muted">
              {d.description}
              {copy("interface.strategyPanels.baseDailyRevenue")}
              {d.revenue}
              {copy("interface.strategyPanels.expenses")}
              {d.expenses}
              {copy("interface.strategyPanels.actualResultsDependOnConditions")}
            </p>
            {b && (
              <p>
                {copy("interface.strategyPanels.funding")}
                {b.provenance}
                {copy("interface.strategyPanels.condition")}
                {Math.round(b.condition)}
                {copy("interface.strategyPanels.latestNet")}
                {b.lastNet}
                {copy("interface.strategyPanels.lifetimeNet")}
                {b.totalNet}
                {copy("interface.strategyPanels.assetValue")}
                {a?.value ?? 0}
                {copy("interface.strategyPanels.provenRecurringNet")}
                {a?.recurringIncome ?? 0}
                {copy("interface.strategyPanels.day3")}
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
                    {d.name}
                    {copy("interface.strategyPanels.1AP3")}
                  </button>
                  {error && <small>{error}</small>}
                </div>
              );
            })}
            {b && (
              <details>
                <summary>
                  {copy("interface.strategyPanels.operatingHistory")}
                </summary>
                {b.history
                  .slice(-7)
                  .reverse()
                  .map((h, i) => (
                    <p key={i}>
                      {copy("interface.strategyPanels.day4")}
                      {h.day}
                      {copy("interface.strategyPanels.text10")}
                      {h.revenue}
                      {copy("interface.strategyPanels.revenue")}
                      {h.expenses} {copy("interface.strategyPanels.expenses2")}
                      {h.net}
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
      aria-label={copy("interface.strategyPanels.legitimateExitProgress")}
    >
      <p className="eyebrow">
        {copy("interface.strategyPanels.aLIFEOFYOUROWN")}
      </p>
      <h3>{copy("interface.strategyPanels.legitimateExit")}</h3>
      {s.street.arrears > 0 && (
        <button
          disabled={
            !!s.end ||
            player(s).status !== "active" ||
            player(s).wallet.clean + player(s).wallet.illicit < s.street.arrears
          }
          onClick={() => r.apply(payArrears(s))}
        >
          {copy("interface.strategyPanels.clearArrears")}
          {s.street.arrears}
        </button>
      )}
      <p>
        {copy("interface.strategyPanels.qualifyingNetWealth")}
        {Math.floor(v.wealth).toLocaleString()}
        {copy("interface.strategyPanels.100000ProvenRecurringNet")}
        {v.income}
        {copy("interface.strategyPanels.day24SustainableDays")}{" "}
        {s.strategic.lawfulStreak}
        {copy("interface.strategyPanels.text11")}
        {B.lawfulSustainDays}
      </p>
      <ul>
        {v.missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {!v.missing.length && (
        <p>
          {copy("interface.strategyPanels.youQualifyRetirementIsYourDecision")}
        </p>
      )}
      <button
        disabled={!!s.end || !!v.missing.length}
        onClick={() => r.apply(retire(s))}
      >
        {copy("interface.strategyPanels.retireVoluntarily")}
      </button>
      {r.message && <p role="status">{r.message}</p>}
    </section>
  );
}
