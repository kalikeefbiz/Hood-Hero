import { MERCHANDISE } from "../content/street";
import type { GameState } from "../core/GameState";
import { player } from "../core/GameState";
import {
  ACTIONS,
  availableActions,
  validateAction,
  type Action,
  type ActionType,
} from "../core/ActionEngine";
import {
  accessStatus,
  contactError,
  introductionCandidates,
} from "../systems/Relationships";
import { suppliers, supplierError } from "../systems/StreetEconomy";
import { currentEmployment, absenceWarning } from "../systems/Employment";
import { ActionCard } from "./ActionCard";
import { EmploymentSummary } from "./EmploymentSummary";
import { StreetWork } from "./StreetWork";
export type ActionCategory = "Streets" | "Honest" | "Connects";
export function ActionsHub({
  s,
  category,
  setCategory,
  focus,
  setFocus,
  act,
  openSupplier,
}: {
  s: GameState;
  category: ActionCategory;
  setCategory: (v: ActionCategory) => void;
  focus: string;
  setFocus: (id: string) => void;
  act: (a: Action) => void;
  openSupplier: (id: string) => void;
}) {
  const p = player(s),
    all = availableActions(s),
    c = s.characters[focus] ?? s.characters.mega;
  const reasonCounts = new Map<string, number>();
  if (category === "Honest")
    for (const a of all.filter((a) =>
      ["acceptJob", "work", "timeOff", "resign", "apply", "gig"].includes(
        a.type,
      ),
    )) {
      const r = validateAction(s, a);
      if (r) reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
    }
  const shared = [...reasonCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([r]) => r);
  const card = (a: Action) => (
    <ActionCard
      key={`${a.type}-${a.target ?? a.jobId ?? ""}`}
      s={s}
      action={a}
      sharedReasonId={
        shared.includes(validateAction(s, a) ?? "")
          ? `honest-reason-${shared.indexOf(validateAction(s, a)!)}`
          : undefined
      }
      onAction={act}
    />
  );
  const connected = p.connections.filter(
    (id) => s.characters[id] && id !== p.id,
  );
  const lock = contactError(s, p.id, c.id),
    rel = c.relationships[p.id];
  const supplier = suppliers(s).some((n) => n.id === c.id);
  const cashError = supplierError(s, c.id, "cash"),
    consError = supplierError(s, c.id, "consignment");
  const reasons = [
    ...new Set([cashError, consError].filter((x): x is string => !!x)),
  ];
  const debt = s.street.agreements.find(
    (a) => a.supplier === c.id && a.debtor === p.id && a.balance > 0,
  );
  const social: ActionType[] = [
    "contact",
    "inquire",
    ...(introductionCandidates(s, p.id, c.id).length
      ? ["introduce" as const]
      : []),
    ...((rel?.trust ?? 0) >= 15 || (rel?.affection ?? 0) >= 15
      ? ["socialize" as const]
      : []),
    ...((rel?.trust ?? 0) >= 20 ? ["offer" as const, "transfer" as const] : []),
    ...(c.affiliation
      ? ["standing" as const, ...(!p.affiliation ? ["affiliate" as const] : [])]
      : []),
  ];
  return (
    <div className={`actions-hub category-${category.toLowerCase()}`}>
      <div
        className="segmented action-categories"
        role="group"
        aria-label="Action categories"
      >
        {(["Streets", "Honest", "Connects"] as const).map((g) => (
          <button
            key={g}
            aria-pressed={category === g}
            className={category === g ? "active" : ""}
            onClick={() => setCategory(g)}
          >
            {g}
          </button>
        ))}
      </div>
      {category === "Streets" && (
        <>
          <StreetWork
            s={s}
            sell={(market) => act({ type: "crime", actor: p.id, market })}
            connects={() => setCategory("Connects")}
          />
          <div className="quiet-option">
            {all.filter((a) => a.type === "rest").map(card)}
          </div>
        </>
      )}
      {category === "Honest" && (
        <>
          {absenceWarning(s) && (
            <p className="attendance-warning" role="status">
              {absenceWarning(s)}
            </p>
          )}
          <EmploymentSummary s={s} />
          {shared.map((r, i) => (
            <p className="disabled-reason" id={`honest-reason-${i}`} key={r}>
              {r}
            </p>
          ))}
          <div className="action-grid honest-priority">
            {all
              .filter(
                (a) =>
                  ["acceptJob", "work", "timeOff"].includes(a.type) &&
                  (a.type === "acceptJob" || !!currentEmployment(s)),
              )
              .map(card)}
          </div>
          <h3>{currentEmployment(s) ? "Local income" : "Find employment"}</h3>
          <div className="action-grid">
            {all.filter((a) => ["apply", "gig"].includes(a.type)).map(card)}
          </div>
          {currentEmployment(s) && (
            <details className="panel">
              <summary>Employment options</summary>
              {all.filter((a) => a.type === "resign").map(card)}
            </details>
          )}
        </>
      )}
      {category === "Connects" && (
        <>
          <label className="person-selector">
            Connected contacts
            <select
              aria-label="Connected contacts"
              value={p.connections.includes(focus) ? focus : ""}
              onChange={(e) => setFocus(e.target.value)}
            >
              <option value="" disabled>
                Select a contact
              </option>
              {connected.map((id) => (
                <option key={id} value={id}>
                  {s.characters[id].alias ?? s.characters[id].name}
                </option>
              ))}
            </select>
          </label>
          <section
            className="panel connect-profile"
            aria-label="Selected contact"
          >
            <p className="eyebrow">
              REACH OUT / {accessStatus(s, p.id, c.id).toUpperCase()}
            </p>
            <h3>{c.alias ?? c.name}</h3>
            <p>
              {s.zones[c.home].name} ·{" "}
              {c.affiliation ? s.factions[c.affiliation].name : "Independent"}
            </p>
            {lock ? (
              <p className="disabled-reason">{lock}</p>
            ) : (
              <>
                {supplier && (
                  <div className="supplier-entry" aria-label="Supplier offer">
                    <strong>
                      {debt
                        ? `Outstanding: $${debt.balance} · due day ${debt.dueDay}`
                        : "Night goods · limited lot"}
                    </strong>
                    {!debt && (
                      <p>
                        {MERCHANDISE.nightgoods.quantity} units · $
                        {MERCHANDISE.nightgoods.wholesale} cash / $
                        {MERCHANDISE.nightgoods.consignment} consignment · 1 AP
                      </p>
                    )}
                    <button onClick={() => openSupplier(c.id)}>
                      {debt
                        ? `Talk repayment with ${c.alias ?? c.name}`
                        : `Talk terms with ${c.alias ?? c.name}`}
                    </button>
                    {!debt &&
                      reasons.map((r) => (
                        <p className="disabled-reason" key={r}>
                          {r}
                        </p>
                      ))}
                  </div>
                )}
                <div className="connect-actions">
                  {s.ap === 0 && (
                    <p className="request-limit">
                      No AP left for contact requests today.
                    </p>
                  )}
                  {all
                    .filter((a) => a.target === c.id && social.includes(a.type))
                    .map((a) => {
                      const reason = validateAction(s, a),
                        label =
                          a.type === "affiliate"
                            ? "Get put on"
                            : ACTIONS[a.type].label;
                      return (
                        <article
                          className="action-card connect-action"
                          data-action={a.type}
                          key={a.type}
                        >
                          <div>
                            <h3>{label}</h3>
                            <small>
                              {ACTIONS[a.type].ap} AP
                              {a.type === "offer"
                                ? " · $20"
                                : a.type === "transfer"
                                  ? " · $25"
                                  : ""}
                            </small>
                            {reason &&
                              reason !== "Not enough AP or availability" && (
                                <p className="disabled-reason">{reason}</p>
                              )}
                          </div>
                          <button
                            disabled={!!reason}
                            aria-label={label}
                            onClick={() => act(a)}
                          >
                            Choose →
                          </button>
                        </article>
                      );
                    })}
                </div>
              </>
            )}
          </section>
          <details className="panel known-contacts">
            <summary>Known of · introductions needed</summary>
            {p.known
              .filter(
                (id) =>
                  !p.connections.includes(id) &&
                  s.characters[id] &&
                  id !== p.id,
              )
              .map((id) => (
                <div className="known-contact" key={id}>
                  <strong>
                    {s.characters[id].alias ?? s.characters[id].name}
                  </strong>
                  <span>{s.zones[s.characters[id].home].name} · Known of</span>
                  <small>
                    Ask an established connection for an introduction.
                    {id === "pablo" &&
                    s.incidents["the-chains"]?.status === "active"
                      ? " The Chains can be brought to him through City."
                      : ""}
                  </small>
                </div>
              ))}
          </details>
        </>
      )}
    </div>
  );
}
