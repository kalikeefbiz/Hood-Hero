import { copy } from "../content/copy";
import { availability, knownCapabilities } from "../systems/CrewAgency";
import type { EncounterInstance, GameState } from "../core/GameState";
import { encounterDefinition, responseError } from "../systems/Encounters";
import { incidentPromise } from "../systems/Commitments";
import { ACTIONS, actionSuccessChance } from "../core/ActionEngine";
import { CharacterPortrait } from "./CharacterPortrait";
import { money } from "./ActionCard";
import { themeStyle } from "./theme";
export function EncounterScene({
  s,
  encounter: e,
  respond,
  dismiss,
  historical = false,
}: {
  s: GameState;
  encounter: EncounterInstance;
  respond: (id: string, response: string) => void;
  dismiss: (id: string) => void;
  historical?: boolean;
}) {
  const d = encounterDefinition(e),
    c = s.characters[e.participants[0]],
    promise = e.incidentId ? incidentPromise(s, e.incidentId) : undefined;
  const source = s.events.find((x) => x.id === e.sourceEventId);
  const last = e.selectedResponses.at(-1),
    resultEvents = last?.eventIds
      .map((id) => s.events.find((x) => x.id === id))
      .filter((x) => x?.observedBy.includes(s.playerId));
  const concerned =
    promise?.status === "broken" ||
    (!promise && s.incidents[e.incidentId ?? ""]?.status === "active");
  const responses = d.responses(s, e);
  const counts = new Map<string, number>();
  if (d.id === "street-supplier")
    for (const r of responses) {
      const error = responseError(s, e, r);
      if (error) counts.set(error, (counts.get(error) ?? 0) + 1);
    }
  return (
    <section
      className="encounter-scene"
      aria-label={copy("interface.encounterScene.characterEncounter")}
      style={themeStyle(c.affiliation)}
    >
      <div className="encounter-top">
        <span className="eyebrow">
          {historical
            ? "RECORDED ENCOUNTER"
            : (source?.title ?? "A CONVERSATION IN THE CITY")}
        </span>
        <button
          className="text-button"
          onClick={() => dismiss(e.id)}
          aria-label={copy("interface.encounterScene.closeConversation")}
        >
          {copy("interface.encounterScene.close")}
        </button>
      </div>
      <div
        className="encounter-scroll"
        tabIndex={0}
        role="region"
        aria-label={copy("interface.encounterScene.dialogue")}
      >
        <div className="encounter-composition">
          <CharacterPortrait
            s={s}
            id={c.id}
            expression={
              d.expression?.(s, e) ?? (concerned ? "concerned" : "confident")
            }
          />
          <div className="encounter-copy">
            <p className="eyebrow">
              {c.affiliation ? s.factions[c.affiliation].name : "Resident"}
            </p>
            <h3>
              {c.name}{" "}
              <small>
                {copy("interface.encounterScene.text")}
                {c.alias ?? ""}
              </small>
            </h3>
            {d.id.startsWith("crew-") && (
              <p className="encounter-fact">
                {knownCapabilities(c)}
                <br />
                {availability(s, c) ?? "Available to discuss plans"}
                {copy("interface.encounterScene.trust")}{" "}
                {Math.round(c.relationships[s.playerId]?.trust ?? 0)}
              </p>
            )}
            <p className="dialogue">
              {copy("interface.encounterScene.text2")}
              {d.dialogue(s, e)}
              {copy("interface.encounterScene.text3")}
            </p>
            {source && (
              <p className="encounter-fact">
                {copy("interface.encounterScene.day")}
                {source.day}
                {copy("interface.encounterScene.text4")}
                {source.text}
              </p>
            )}
            {promise && (
              <p className="promise-status">
                <strong>
                  {copy("interface.encounterScene.yourWord")}
                  {promise.status}
                </strong>
                {promise.status === "pending" && (
                  <span>
                    {Math.max(0, promise.dueDay - s.day)}
                    {copy("interface.encounterScene.daysRemainingBeforeDay")}
                    {promise.dueDay}
                    {copy(
                      "interface.encounterScene.beginsTheDisputeCanEndSooner",
                    )}
                  </span>
                )}
              </p>
            )}
            {last && resultEvents?.length && !source ? (
              <p className="encounter-result" role="status">
                {resultEvents.at(-1)?.text}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className="encounter-responses"
        role="group"
        aria-label={copy("interface.encounterScene.yourResponse")}
      >
        {[...counts.entries()]
          .filter(([, n]) => n > 1)
          .map(([reason]) => (
            <p className="disabled-reason" key={reason}>
              {reason}
            </p>
          ))}
        {historical ? (
          <button className="encounter-response" onClick={() => dismiss(e.id)}>
            {copy("interface.encounterScene.returnToCity")}
          </button>
        ) : (
          responses.map((r) => {
            const reason = responseError(s, e, r),
              action = r.effect.type === "action" ? r.effect.action : null;
            const chance = action ? actionSuccessChance(s, action) : null;
            return (
              <button
                key={r.id}
                data-response={r.id}
                className="encounter-response"
                disabled={!!reason}
                onClick={() => respond(e.id, r.id)}
              >
                <span>{r.label}</span>
                <small>
                  {r.detail ??
                    (action
                      ? `${ACTIONS[action.type].ap} AP${action.type === "buyback" ? ` · ${money(s.incidents[action.incidentId!].demand)}` : ""} · ${ACTIONS[action.type].risk} risk${chance !== null ? ` · ${Math.round(chance * 100)}% success` : ""}`
                      : r.effect.type === "crew"
                        ? "Personal request · costs and conditions above; refusal costs no AP"
                        : "Conversation · No AP")}
                </small>
                {reason && (counts.get(reason) ?? 0) < 2 && (
                  <small className="disabled-reason">{reason}</small>
                )}
              </button>
            );
          })
        )}
      </div>
      <p className="encounter-footer">
        {historical
          ? "A recorded outcome. Viewing it changes no relationships or obligations."
          : d.id === "workplace"
            ? "Shift wages and attendance are recorded. Closing defers this choice; ending the day applies the Skip scene outcome."
            : "Closing makes no new promise. Unfinished conversations can be resumed from City."}
      </p>
    </section>
  );
}
