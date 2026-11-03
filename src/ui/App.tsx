import { copy } from "../content/copy";
import {
  NeighborhoodStrategy,
  OrganizationPanel,
  BusinessPanel,
  RetirementPanel,
} from "./StrategyPanels";
import { ActionsHub, type ActionCategory } from "./ActionsHub";
import { InventoryWallet } from "./InventoryWallet";
import { accessStatus, contactError } from "../systems/Relationships";
import { encounterDefinition } from "../systems/EncounterLifecycle";
import { openSupplier } from "../content/streetEncounters";
import {
  openCrewConversation,
  openStoryline,
} from "../systems/EncounterLifecycle";
import { availability, knownCapabilities } from "../systems/CrewAgency";
import { useEffect, useState, type ReactNode } from "react";
import {
  type GameState,
  type ZoneId,
  type Character,
  player,
  cash,
} from "../core/GameState";
import { newGame } from "../core/Simulation";
import { advanceDay, serveSentence } from "../core/TimeSystem";
import {
  ACTIONS,
  availableActions,
  performAction,
  validateAction,
  type Action,
  type ActionType,
} from "../core/ActionEngine";
import { Modal } from "./Modal";
import { ActivityFeed } from "./ActivityFeed";
import { syncEncounters } from "../systems/EncounterLifecycle";
import { EncounterScene } from "./EncounterScene";
import { NarrativeNotifications } from "./NarrativeNotifications";
import { EmploymentSummary } from "./EmploymentSummary";
import { absenceWarning } from "../systems/Employment";
import { CommitmentSummary } from "./CommitmentSummary";
import { CharacterPortrait } from "./CharacterPortrait";
import {
  currentEncounter,
  dismissEncounter,
  openEncounter,
  respondEncounter,
} from "../systems/Encounters";
import "./encounters.css";
import {
  acknowledgeEvent,
  importantEvents,
  unseenEvents,
  visibleEvents,
} from "../core/EventLog";
import { ZONES } from "../content/city";
import {
  loadGame,
  saveGame,
  SAVE_KEY,
  AUTO_KEY,
} from "../persistence/SaveSystem";
import { CityMap } from "./CityMap";
import { NewRun } from "./NewRun";
import { GameHUD } from "./GameHUD";
import { ActionCard, money } from "./ActionCard";
import { Scene } from "./Scene";
import { Icon, type IconName } from "./Icon";
import { themeStyle } from "./theme";
import { THEMES } from "./theme";
import { BALANCE } from "../content/balance";
type Screen = "City" | "People" | "Actions" | "Set" | "Finances";
const nav: Record<Screen, IconName> = {
  City: "City",
  People: "People",
  Actions: "Actions",
  Set: "Set",
  Finances: "Finances",
};
const band = (n: number, words: string[]) =>
  words[n < 20 ? 0 : n < 45 ? 1 : n < 70 ? 2 : 3];
function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function Meter({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>{description}</strong>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}
        aria-valuetext={description}
      >
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
function Portrait({ c }: { c: Character }) {
  return (
    <span
      className="portrait"
      style={themeStyle(c.affiliation)}
      aria-hidden="true"
    >
      {c.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function App() {
  const [s, setState] = useState<GameState | null>(null),
    [screen, setScreen] = useState<Screen>("City"),
    [notice, setNotice] = useState(""),
    [name, setName] = useState(""),
    [home, setHome] = useState<ZoneId>("south"),
    [selected, setSelected] = useState<ZoneId>("south"),
    [focus, setFocus] = useState("mega"),
    [actionGroup, setGroup] = useState<ActionCategory>("Streets"),
    [activityFilter, setActivityFilter] = useState("All");
  const [hasSave, setHasSave] = useState(false);
  const [historyEncounterId, setHistoryEncounterId] = useState<string | null>(
    null,
  );
  const [dayTransition, setDayTransition] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [actionFeedback]);
  useEffect(() => {
    if (dayTransition === null) return;
    const timer = window.setTimeout(() => setDayTransition(null), 2200);
    return () => clearTimeout(timer);
  }, [dayTransition]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, !!s]);
  useEffect(() => {
    try {
      setHasSave(
        !!(localStorage.getItem(SAVE_KEY) || localStorage.getItem(AUTO_KEY)),
      );
    } catch {
      setNotice(copy("interface.notice.localStorageIsUnavailableThisTabCan"));
    }
  }, []);
  useEffect(() => {
    if (s)
      try {
        saveGame(localStorage, s, AUTO_KEY);
        setHasSave(true);
      } catch (e) {
        setNotice((e as Error).message);
      }
  }, [s]);
  function start() {
    window.scrollTo(0, 0);
    setActionFeedback(null);
    const next = newGame(name, home);
    setState(next);
    setSelected(home);
    setScreen("City");
    setHistoryEncounterId(null);
    setNotice(copy("interface.notice.youReHomeFindWorkCheckOn"));
  }
  function load(resume = false) {
    setActionFeedback(null);
    try {
      const next = resume
        ? loadGame(localStorage, AUTO_KEY) || loadGame(localStorage)
        : loadGame(localStorage) || loadGame(localStorage, AUTO_KEY);
      if (next) {
        window.scrollTo(0, 0);
        setState(next);
        setSelected(player(next).home);
        setScreen("City");
        setHistoryEncounterId(null);
        setNotice(copy("interface.notice.loadedDay", { day: next.day }));
      } else setNotice(copy("interface.notice.noSavedGameYet"));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function save() {
    setActionFeedback(null);
    if (s)
      try {
        saveGame(localStorage, s);
        setHasSave(true);
        setNotice(copy("interface.notice.savedDay", { day: s.day }));
      } catch (e) {
        setNotice((e as Error).message);
      }
  }
  function act(a: Action) {
    if (!s) return;
    const result = performAction(s, a);
    if (result.error) {
      setNotice(result.error);
      setActionFeedback(result.error);
    } else {
      setState(result.state);
      if (a.target && actionGroup === "Connects") {
        setGroup("Streets");
        setScreen("Actions");
      }
      if (
        result.state.encounters.some(
          (e) => e.definitionId === "workplace" && e.status === "active",
        )
      )
        setScreen("City");
      const message = result.event?.text ?? "Action completed.";
      setNotice(message);
      setActionFeedback(message);
    }
  }
  function respond(id: string, response: string) {
    if (!s) return;
    const result = respondEncounter(s, id, response);
    if (result.error) setNotice(result.error);
    else {
      setState(result.state);
      const crewResponse = s.encounters
        .find((e) => e.id === id)
        ?.definitionId.startsWith("crew-");
      const streetResponse = s.encounters
        .find((e) => e.id === id)
        ?.definitionId.startsWith("street-");
      const sourceEncounter = s.encounters.find((e) => e.id === id)!;
      const actionResponse =
        encounterDefinition(sourceEncounter)
          .responses(s, sourceEncounter)
          .find((r) => r.id === response)?.effect.type === "action";
      const actionResult =
        result.state.events
          .slice(s.events.length)
          .find((e) => e.category === "money") ??
        result.state.events.slice(s.events.length).at(-1);
      const reply = actionResponse
        ? (actionResult?.text ?? "Action completed.")
        : streetResponse
          ? (result.state.events.slice(s.events.length).at(-1)?.text ??
            (response === "terms"
              ? "Supplier terms clarified; no goods or debt accepted."
              : "Supplier conversation concluded."))
          : crewResponse
            ? (result.state.events.slice(s.events.length).at(-1)?.text ??
              (response === "details"
                ? "They shared more about their plans."
                : "Conversation concluded."))
            : response === "promise"
              ? "Cuzzo: ‘I’m counting on you.’ Your promise is recorded. Return through City → Storylines."
              : response === "decline"
                ? "Cuzzo: ‘Alright. I heard you. I’ll figure out what I can do.’ No promise was made."
                : response === "delay"
                  ? "You asked for time to think. The situation continues; resume the conversation from City."
                  : response === "acknowledge"
                    ? "Outcome acknowledged. The city moves on; the history remains."
                    : s.encounters.find((e) => e.id === id)?.definitionId ===
                        "workplace"
                      ? (result.state.events.at(-1)?.text ??
                        "Workplace choice recorded.")
                      : "Cuzzo explains what happened.";
      const finished = result.state.encounters.find((e) => e.id === id);
      if (
        finished?.status === "acknowledged" &&
        ["street-supplier", "crew-conversation"].includes(finished.definitionId)
      ) {
        setScreen("Actions");
        setGroup("Streets");
        setHistoryEncounterId(null);
      }
      setNotice(reply);
      if (response !== "clarify") setActionFeedback(reply);
    }
  }
  function showConversation(id: string) {
    if (!s) return;
    setState(openEncounter(s, id));
    setScreen("City");
    setHistoryEncounterId(null);
    window.scrollTo(0, 0);
  }
  function viewReaction(eventId: string) {
    if (!s) return;
    const e = s.encounters.find((e) => e.sourceEventId === eventId);
    if (e) {
      showConversation(e.id);
      window.scrollTo(0, 0);
    }
  }
  function replayReaction(eventId: string) {
    if (!s) return;
    const e = s.encounters.find((e) => e.sourceEventId === eventId);
    if (e) {
      setHistoryEncounterId(e.id);
      setScreen("City");
      window.scrollTo(0, 0);
    }
  }
  function interact(id: string) {
    if (!s) return;
    setState(openCrewConversation(s, id));
    setScreen("City");
    setHistoryEncounterId(null);
  }
  function openPerson(id: string) {
    setFocus(id);
    setGroup("Connects");
    setScreen("Actions");
  }
  const toast = (
    <div
      className="notice"
      role={actionFeedback ? undefined : "status"}
      aria-live={actionFeedback ? "off" : "polite"}
    >
      {notice || "A persistent city. Every day leaves a mark."}
    </div>
  );
  if (!s)
    return (
      <NewRun
        name={name}
        home={home}
        setName={setName}
        setHome={setHome}
        start={start}
        load={() => load(true)}
        hasSave={hasSave}
        feedback={toast}
      />
    );
  const p = player(s),
    incident = s.incidents["the-chains"],
    person = s.characters[focus] ?? s.characters.mega;
  // The Chains is the current game’s only routed storyline. Closed stories
  // stay in history; they must not create a new call to action on City.
  const activeStory = incident?.status === "active" ? incident : null;
  const encounter = currentEncounter(s);
  const historical = historyEncounterId
    ? s.encounters.find((e) => e.id === historyEncounterId)
    : undefined;
  const presented = screen === "City" ? (historical ?? encounter) : undefined;
  const request = s.encounters.find(
    (e) => e.definitionId === "mega-chains-request" && e.status === "pending",
  );
  const all = availableActions(s);
  const actionCard = (a: Action) => (
    <ActionCard
      key={`${a.type}-${a.target ?? a.item ?? a.jobId ?? ""}`}
      s={s}
      action={a}
      onAction={act}
    />
  );
  return (
    <div
      className={`game-shell screen-${screen.toLowerCase()}`}
      style={themeStyle(null)}
      data-theme={p.affiliation ?? "independent"}
    >
      <a className="skip-link" href="#main-content">
        {copy("interface.app.skipToGame")}
      </a>
      <aside className="desktop-brand">
        <p className="eyebrow">{copy("interface.app.blackhousePRESENTS")}</p>
        <h2>
          {copy("interface.app.hood")}
          <br />
          {copy("interface.app.hero")}
        </h2>
        <p className="city-label">{copy("interface.app.stixxCITY")}</p>
        <div className="side-note">
          {copy("interface.app.aCityWithAMemory")}
          <br />
          {copy("interface.app.aLifeOfYourOwn")}
        </div>
        <Scene zone={p.home} />
        <span className="sidebar-home">
          {copy("interface.app.yourROOTS")}
          {s.zones[p.home].name}
        </span>
      </aside>
      <div className="game-body">
        <GameHUD
          s={s}
          selected={selected}
          cinematic={screen === "City"}
          save={save}
          load={() => load(false)}
        />
        <main className="main-content" id="main-content">
          {actionFeedback && (
            <div className="action-feedback" role="status" aria-live="polite">
              <small>{copy("interface.app.yourMOVE")}</small>
              <p>{actionFeedback}</p>
            </div>
          )}
          <div className="screen-heading">
            <div>
              <p className="eyebrow">
                {copy("interface.app.stixxCITY2")}
                {screen.toUpperCase()}
              </p>
              <h2>
                {screen === "City"
                  ? "Know your city."
                  : screen === "People"
                    ? "People remember."
                    : screen === "Actions"
                      ? "Make your next move."
                      : screen === "Set"
                        ? "Your people. Your Set."
                        : "Keep yourself afloat."}
              </h2>
            </div>
            <button
              className="advance"
              onClick={() => {
                const warning = absenceWarning(s);
                if (warning && !window.confirm(warning + " End day anyway?"))
                  return;
                setActionFeedback(null);
                const next = advanceDay(s);
                setState(next);
                setScreen("City");
                setHistoryEncounterId(null);
                window.scrollTo(0, 0);
                setDayTransition(next.day);
                setNotice(copy("interface.notice.day", { day: next.day }));
              }}
              disabled={!!s.end}
            >
              {copy("interface.app.endDay")}
              <span>{copy("interface.app.text")}</span>
            </button>
          </div>
          {screen === "City" && dayTransition !== null && (
            <div className="day-transition" aria-hidden="true">
              {copy("interface.app.day")}
              {dayTransition.toString().padStart(2, "0")}
              {copy("interface.app.theCityHasMovedTwoAPRestored")}
            </div>
          )}
          {screen === "City" && !presented && (
            <NarrativeNotifications
              s={s}
              acknowledge={(id) => {
                const next = acknowledgeEvent(s, id);
                syncEncounters(next);
                setState(next);
              }}
              view={viewReaction}
            />
          )}
          {presented && (
            <Modal
              key={presented.id + (historical ? ":history" : "")}
              label={copy("interface.app.characterEncounter")}
              onDismiss={() =>
                historical
                  ? setHistoryEncounterId(null)
                  : setState(dismissEncounter(s, presented.id))
              }
            >
              <EncounterScene
                s={s}
                encounter={presented}
                historical={!!historical}
                respond={respond}
                dismiss={() =>
                  historical
                    ? setHistoryEncounterId(null)
                    : setState(dismissEncounter(s, presented.id))
                }
              />
            </Modal>
          )}
          {screen === "City" && !presented && request && (
            <div className="narrative-links">
              <button
                className="secondary"
                onClick={() => showConversation(request.id)}
              >
                {copy("interface.app.continueConversationWithCuzzo")}
              </button>
            </div>
          )}
          {screen === "City" &&
            !presented &&
            s.encounters
              .filter(
                (e) =>
                  ["workplace", "crew-offer"].includes(e.definitionId) &&
                  e.status === "pending",
              )
              .map((e) => (
                <div className="narrative-links" key={e.id}>
                  <button
                    className="secondary"
                    onClick={() => showConversation(e.id)}
                  >
                    {e.definitionId === "crew-offer"
                      ? `Hear from ${s.characters[e.participants[0]].name}`
                      : "Resume workplace conversation"}
                  </button>
                </div>
              ))}
          {screen === "City" && <CommitmentSummary s={s} />}
          {s.end && (
            <Panel className="ending">
              <h3>
                {s.end === "arrested"
                  ? "Your run ended: arrested"
                  : s.end === "killed"
                    ? "Your run ended: killed"
                    : `Victory: ${s.end}`}
              </h3>
              <p>
                {s.strategic.ending
                  ? s.events.find((e) => e.id === s.strategic.ending?.eventId)
                      ?.text
                  : ""}{" "}
                {copy(
                  "interface.app.yourHistoryRemainsAvailableToInspectStart",
                )}
              </p>
            </Panel>
          )}
          {p.status === "arrested" && (
            <Panel>
              <h3>{copy("interface.app.inCustody")}</h3>
              <p>
                {copy("interface.app.releaseDay")}{" "}
                {s.street.custody.find(
                  (r) => r.character === p.id && r.status === "held",
                )?.releaseDay ?? "not defined"}
                {copy(
                  "interface.app.streetActionsAndOrdinaryWorkAreUnavailable",
                )}
              </p>
              <button
                onClick={() => {
                  setState(serveSentence(s));
                  setScreen("City");
                }}
              >
                {copy("interface.app.serveRemainingSentence")}
              </button>
            </Panel>
          )}
          {screen !== "City" && toast}
          {screen === "City" && (
            <>
              {activeStory && (
                <section
                  className="storylines"
                  aria-label={copy("interface.app.storylines")}
                >
                  <h3>{copy("interface.app.storylines2")}</h3>
                  <button
                    className="dispatch story-alert"
                    aria-label={`Open ${activeStory.title} storyline`}
                    onClick={() => {
                      setState(openStoryline(s, activeStory.id));
                      setScreen("City");
                    }}
                  >
                    <span className="dispatch-icon" aria-hidden="true">
                      <Icon name="message" />
                    </span>
                    <span>
                      <span className="eyebrow">
                        {copy("interface.app.wordONTHEBLOCK")}
                      </span>
                      <strong>{activeStory.title}</strong>
                      <span className="story-status">
                        {copy("interface.app.demand")}
                        {money(activeStory.demand)}
                        {copy("interface.app.text2")}{" "}
                        {activeStory.leadershipAware
                          ? "Leadership is considering its response"
                          : "Awaiting your help"}
                      </span>
                    </span>
                    <Icon name="arrow" />
                  </button>
                </section>
              )}
              {toast}
              <div className="city-layout">
                <Panel className="map-panel">
                  <div className="panel-title">
                    <h3>{copy("interface.app.stixxCity")}</h3>
                    <span className="map-key">
                      {copy("interface.app.yourHome")}
                    </span>
                  </div>
                  <CityMap s={s} selected={selected} onSelect={setSelected} />
                  <ul
                    className="map-legend"
                    aria-label={copy("interface.app.factionColors")}
                  >
                    {Object.values(s.factions).map((f) => (
                      <li key={f.id}>
                        <i
                          style={{ background: THEMES[f.id].accent }}
                          aria-hidden="true"
                        />
                        {f.name}
                      </li>
                    ))}
                  </ul>
                  <p className="caption">
                    {copy("interface.app.selectANeighborhoodToReadItsPolitics")}
                  </p>
                </Panel>
                <div className="zone-details">
                  <Panel>
                    <span className="eyebrow">
                      {s.zones[selected].subtitle}
                    </span>
                    <h3>{s.zones[selected].name}</h3>
                    <p>
                      {selected === "resevoir"
                        ? ZONES.resevoir.description
                        : s.zones[selected].description}
                    </p>
                    <p className="control-label">
                      {copy("interface.app.control")}{" "}
                      {s.zones[selected].controller
                        ? s.factions[s.zones[selected].controller!].name
                        : "No single controller"}
                    </p>
                    <NeighborhoodStrategy
                      key={selected}
                      s={s}
                      zone={selected}
                      onChange={setState}
                    />
                    <div className="tags">
                      {s.zones[selected].organizations.length ? (
                        s.zones[selected].organizations.map((f) => (
                          <span
                            key={f}
                            style={{ borderColor: THEMES[f].accent }}
                          >
                            {s.factions[f].name}
                          </span>
                        ))
                      ) : (
                        <span>{copy("interface.app.unclaimed")}</span>
                      )}
                    </div>
                    <Meter
                      label={copy("interface.app.policePresence")}
                      value={s.zones[selected].police}
                      description={band(s.zones[selected].police, [
                        "Minimal",
                        "Light",
                        "Elevated",
                        "Heavy",
                      ])}
                    />
                    <Meter
                      label={copy("interface.app.yourLocalStanding")}
                      value={p.neighborhoodStanding[selected]}
                      description={band(p.neighborhoodStanding[selected], [
                        "Unknown",
                        "Familiar face",
                        "Trusted",
                        "Influential",
                      ])}
                    />
                    <button
                      className="text-button"
                      onClick={() => {
                        const local = p.known.find(
                          (id) => s.characters[id]?.home === selected,
                        );
                        if (local) setFocus(local);
                        setScreen("People");
                      }}
                    >
                      {copy("interface.app.meetLocalPeople")}
                    </button>
                  </Panel>
                </div>
              </div>

              <EmploymentSummary s={s} />
              <Panel>
                <div className="panel-title">
                  <h3>{copy("interface.app.yourPosition")}</h3>
                  <span className="eyebrow">
                    {copy("interface.app.separateREPUTATIONS")}
                  </span>
                </div>
                <div className="meters">
                  <Meter
                    label={copy("interface.app.stress")}
                    value={p.stress}
                    description={band(p.stress, [
                      "At ease",
                      "Managing",
                      "Strained",
                      "Overwhelmed",
                    ])}
                  />
                  <Meter
                    label={copy("interface.app.legitimacy")}
                    value={p.legitimacy}
                    description={band(p.legitimacy, [
                      "Unestablished",
                      "Credible",
                      "Respected",
                      "Established",
                    ])}
                  />
                  <Meter
                    label={copy("interface.app.notoriety")}
                    value={p.notoriety}
                    description={band(p.notoriety, [
                      "Under the radar",
                      "Recognized",
                      "Talked about",
                      "Notorious",
                    ])}
                  />
                  <Meter
                    label={copy("interface.app.policeAttention")}
                    value={p.police}
                    description={band(p.police, [
                      "Quiet",
                      "Noticed",
                      "Under scrutiny",
                      "In danger",
                    ])}
                  />
                  <Meter
                    label={copy("interface.app.personalInfluence")}
                    value={p.influence}
                    description={band(p.influence, [
                      "Small circle",
                      "Connected",
                      "Influential",
                      "Well established",
                    ])}
                  />
                  <Meter
                    label={copy("interface.app.rivalPressure")}
                    value={p.rivalThreat}
                    description={band(p.rivalThreat, [
                      "No active threat",
                      "Friction",
                      "Exposed",
                      "In danger",
                    ])}
                  />
                </div>
              </Panel>
            </>
          )}
          {screen === "People" && (
            <div className="people-layout">
              <div className="people-list">
                {p.known
                  .filter((id) => id !== p.id && s.characters[id])
                  .map((id) => {
                    const c = s.characters[id];
                    return (
                      <button
                        key={id}
                        className={`person-row ${focus === id ? "selected" : ""}`}
                        onClick={() => setFocus(id)}
                      >
                        <Portrait c={c} />
                        <span>
                          <strong>{c.alias ?? c.name}</strong>
                          <small>
                            {c.affiliation
                              ? s.factions[c.affiliation].name
                              : "Civilian"}{" "}
                            {copy("interface.app.text3")}
                            {c.status}
                          </small>
                        </span>
                        <span>{copy("interface.app.text4")}</span>
                      </button>
                    );
                  })}
              </div>
              <Panel className="profile">
                <div className="profile-scene">
                  <Scene key={person.home} zone={person.home} />
                  <span>{s.zones[person.home].name}</span>
                </div>
                <CharacterPortrait s={s} id={person.id} />
                <p className="eyebrow">{s.zones[person.home].name}</p>
                <h3>
                  {person.name}
                  {person.alias && (
                    <small>
                      {copy("interface.app.text5")}
                      {person.alias}
                    </small>
                  )}
                </h3>
                <p>{person.description}</p>
                {p.connections.includes(person.id) && (
                  <p className="muted">{knownCapabilities(person)}</p>
                )}
                {s.crew.members.includes(person.id) && (
                  <button
                    className="secondary"
                    onClick={() => interact(person.id)}
                  >
                    {copy("interface.app.interactWith")}
                    {person.name}
                  </button>
                )}
                <p className="muted">
                  {person.status === "active"
                    ? person.availableDay > s.day
                      ? "Currently committed elsewhere."
                      : `${accessStatus(s, p.id, person.id)}${contactError(s, p.id, person.id) ? " · " + contactError(s, p.id, person.id) : " · Available to contact"}`
                    : "Currently " + person.status + "."}
                </p>
                {p.connections.includes(person.id) && (
                  <>
                    <Meter
                      label={copy("interface.app.theirTrustInYou")}
                      value={person.relationships[p.id]?.trust ?? 0}
                      description={band(
                        person.relationships[p.id]?.trust ?? 0,
                        ["Wary", "Acquainted", "Trusting", "Close"],
                      )}
                    />
                    <Meter
                      label={copy("interface.app.yourTrustInThem")}
                      value={p.relationships[person.id]?.trust ?? 0}
                      description={band(
                        p.relationships[person.id]?.trust ?? 0,
                        ["Wary", "Acquainted", "Trusting", "Close"],
                      )}
                    />
                    <p className="muted">
                      {copy("interface.app.work")}
                      {person.skills.work}
                      {copy("interface.app.social")}
                      {person.skills.social} {copy("interface.app.recovery")}
                      {person.skills.recovery}
                    </p>
                  </>
                )}
                <button
                  className="primary"
                  disabled={!!contactError(s, p.id, person.id)}
                  onClick={() => openPerson(person.id)}
                >
                  {copy("interface.app.interactWith2")}
                  {person.alias ?? person.name}
                  {copy("interface.app.text6")}
                </button>
                <h4>{copy("interface.app.yourSharedHistory")}</h4>
                {p.memories
                  .filter((m) => m.about === person.id)
                  .slice(-4)
                  .reverse()
                  .map((m, i) => (
                    <p className="memory" key={i}>
                      <small>
                        {copy("interface.app.day2")}
                        {m.day}
                      </small>
                      {m.meaning}
                    </p>
                  ))}
                {!p.memories.some((m) => m.about === person.id) && (
                  <p className="muted">
                    {copy("interface.app.youHaveNotSharedASignificantEvent")}
                  </p>
                )}
                <h4>{copy("interface.app.eventsYouWitnessed")}</h4>
                {visibleEvents(s)
                  .filter((e) => e.actors.includes(person.id))
                  .slice(-4)
                  .reverse()
                  .map((e) => (
                    <p className="memory" key={e.id}>
                      <small>
                        {copy("interface.app.day3")}
                        {e.day}
                      </small>
                      {e.text}
                    </p>
                  ))}
              </Panel>
            </div>
          )}
          {screen === "Actions" && (
            <ActionsHub
              s={s}
              category={actionGroup}
              setCategory={setGroup}
              focus={focus}
              setFocus={setFocus}
              act={act}
              openSupplier={(id) => {
                setState(openSupplier(s, id));
                setScreen("City");
              }}
            />
          )}
          {screen === "Set" && (
            <>
              <OrganizationPanel s={s} onChange={setState} />
              <Panel>
                <div className="panel-title">
                  <h3>{copy("interface.app.aPersonalCrew")}</h3>
                  <span className="status-chip">
                    {s.crew.members.length}
                    {copy("interface.app.text7")}
                    {s.crew.capacity}
                    {copy("interface.app.members")}
                  </span>
                </div>
                <p>{copy("interface.app.yourSetIsACircleOfUp")}</p>
                <p className="muted">
                  {copy("interface.app.currentInfluence")}
                  {Math.floor(p.influence)}
                  {copy(
                    "interface.app.membersKeepTheirOwnAffiliationsResourcesAnd",
                  )}
                </p>
              </Panel>
              <div className="action-grid">
                {s.crew.members.map((id) => {
                  const c = s.characters[id];
                  return (
                    <Panel key={id}>
                      <div className="person-title">
                        <CharacterPortrait s={s} id={id} />
                        <div>
                          <h3>{c.name}</h3>
                          <small>
                            {c.status !== "active"
                              ? c.status
                              : c.availableDay > s.day
                                ? "Committed"
                                : "Available"}{" "}
                            {copy("interface.app.work2")}
                            {c.skills.work}
                          </small>
                        </div>
                      </div>
                      <p>{c.description}</p>
                      <Meter
                        label={copy("interface.app.theirTrustInYou2")}
                        value={c.relationships[p.id]?.trust ?? 0}
                        description={`${Math.round(c.relationships[p.id]?.trust ?? 0)} / 100`}
                      />
                      <p className="muted">{knownCapabilities(c)}</p>
                      <p>
                        {availability(s, c) ?? "Available to discuss plans"}
                      </p>
                      <button
                        className="secondary"
                        disabled={!!s.end}
                        onClick={() => interact(id)}
                      >
                        {copy("interface.app.interactWith3")}
                        {c.name}
                      </button>
                      {(["remove"] as ActionType[]).map((type) => {
                        const a: Action = { type, actor: p.id, target: id },
                          reason = validateAction(s, a);
                        return (
                          <button
                            className="secondary"
                            key={type}
                            disabled={!!reason}
                            onClick={() => act(a)}
                          >
                            {ACTIONS[type].label}
                            {copy("interface.app.1AP")}
                            {reason ? ` · ${reason}` : ""}
                          </button>
                        );
                      })}
                    </Panel>
                  );
                })}
              </div>
              <Panel>
                <h3>{copy("interface.app.plansOpportunities")}</h3>
                {s.crewOffers
                  .filter((o) => o.status === "pending")
                  .map((o) => (
                    <p key={o.id}>
                      {s.characters[o.member].name}
                      {copy("interface.app.invitationForDay")} {o.activityDay}{" "}
                      <button
                        className="secondary"
                        onClick={() => {
                          const e = s.encounters.find(
                            (e) => e.crewOfferId === o.id,
                          );
                          if (e) showConversation(e.id);
                        }}
                      >
                        {copy("interface.app.hearTheOffer")}
                      </button>
                    </p>
                  ))}
                {s.assignments
                  .filter((a) => ["accepted", "active"].includes(a.status))
                  .map((a) => (
                    <p key={a.id}>
                      {s.characters[a.member].name}
                      {copy("interface.app.text8")}
                      {a.objective}
                      {copy("interface.app.text9")}
                      {a.status} {copy("interface.app.day4")}
                      {a.dueDay}
                      {a.status === "accepted" && (
                        <button
                          className="secondary"
                          onClick={() => interact(a.member)}
                        >
                          {copy("interface.app.meetForScheduledActivity")}
                        </button>
                      )}
                    </p>
                  ))}
                {s.assignments
                  .filter((a) => ["resolved", "refused"].includes(a.status))
                  .slice(-3)
                  .reverse()
                  .map((a) => (
                    <p className="muted" key={a.id}>
                      {a.outcome}
                    </p>
                  ))}
                {!s.assignments.length && !s.crewOffers.length && (
                  <p className="muted">
                    {copy("interface.app.noPlansYetTalkWithAMember")}
                  </p>
                )}
              </Panel>
              <h3>{copy("interface.app.peopleYouCouldAsk")}</h3>
              <p className="muted">
                {copy(
                  "interface.app.availablePeopleNeed42TrustCompatibleLoyalties",
                )}
              </p>
              <div className="recruit-list">
                {p.known
                  .filter(
                    (id) =>
                      id !== p.id &&
                      !s.crew.members.includes(id) &&
                      s.characters[id]?.status === "active",
                  )
                  .map((id) => {
                    const c = s.characters[id],
                      a: Action = { type: "recruit", actor: p.id, target: id },
                      reason = validateAction(s, a);
                    return (
                      <div key={id} className="recruit-row">
                        <Portrait c={c} />
                        <span className="recruit-info">
                          <strong>{c.name}</strong>
                          <small>
                            {copy("interface.app.trust")}{" "}
                            {Math.round(c.relationships[p.id]?.trust ?? 0)}
                            {copy("interface.app.text10")}{" "}
                            {c.affiliation
                              ? s.factions[c.affiliation].name
                              : "Civilian"}
                          </small>
                          <small>{knownCapabilities(c)}</small>
                          {reason && (
                            <small className="disabled-reason">{reason}</small>
                          )}
                        </span>
                        <button
                          disabled={!!reason}
                          title={reason ?? "Recruit for 1 AP"}
                          onClick={() => act(a)}
                        >
                          {copy("interface.app.invite")}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Build relationship with ${c.name}`}
                          onClick={() => openPerson(id)}
                        >
                          <Icon name="arrow" />
                        </button>
                      </div>
                    );
                  })}
              </div>
              <CommitmentSummary s={s} />
              <h3>{copy("interface.app.setErrands")}</h3>
              {s.commitments
                .filter((c) => c.kind === "errand")
                .slice(-5)
                .reverse()
                .map((o) => (
                  <p className="memory" key={o.id}>
                    {s.characters[o.actor].name}
                    {copy("interface.app.localErrandDueDay")} {o.dueDay}
                    {copy("interface.app.text11")}
                    {o.status}
                  </p>
                ))}
              {!s.commitments.length && (
                <p className="muted">
                  {copy("interface.app.assignAMemberToAPaidErrand")}
                </p>
              )}
            </>
          )}
          {screen === "Finances" && (
            <>
              <Panel>
                <p className="eyebrow">{copy("interface.app.cashONHAND")}</p>
                <h3 className="cash-total">{money(cash(p))}</h3>
                <div className="finance-split">
                  <span>
                    <small>{copy("interface.app.clean")}</small>
                    <strong>{money(p.wallet.clean)}</strong>
                  </span>
                  <span>
                    <small>{copy("interface.app.illicit")}</small>
                    <strong>{money(p.wallet.illicit)}</strong>
                  </span>
                  <span>
                    <small>{copy("interface.app.dailyLIVING")}</small>
                    <strong>{money(BALANCE.livingCost)}</strong>
                  </span>
                </div>
                <p>
                  {copy("interface.app.livingExpensesAreChargedAsYouAdvance")}
                </p>
                <p className="muted">
                  {copy(
                    "interface.app.cleanAndIllicitFundsKeepSeparateProvenance",
                  )}
                </p>
              </Panel>
              <InventoryWallet
                s={s}
                open={(id) => {
                  setState(openSupplier(s, id));
                  setScreen("City");
                }}
              />
              <BusinessPanel s={s} onChange={setState} />
              <RetirementPanel s={s} onChange={setState} />
              <h3>{copy("interface.app.personalPurchases")}</h3>
              <div className="action-grid">
                {all.filter((a) => a.type === "buy").map(actionCard)}
              </div>
              <Panel>
                <h3>{copy("interface.app.moneyTrail")}</h3>
                {s.ledger
                  .slice(-20)
                  .reverse()
                  .map((entry, i) => (
                    <div className="ledger" key={i}>
                      <span>
                        <strong>{entry.reason}</strong>
                        <small>
                          {copy("interface.app.day5")}
                          {entry.day}
                          {copy("interface.app.text12")}
                          {entry.provenance.toUpperCase()}
                        </small>
                      </span>
                      <b className={entry.amount > 0 ? "positive" : ""}>
                        {entry.amount > 0 ? "+" : ""}
                        {money(entry.amount)}
                      </b>
                    </div>
                  ))}
                {!s.ledger.length && (
                  <p className="muted">
                    {copy("interface.app.yourFirst125IsCleanStartingCash")}
                  </p>
                )}
              </Panel>
            </>
          )}
          {screen === "City" && (
            <section id="city-activity" aria-labelledby="city-activity-title">
              <h3 id="city-activity-title">{copy("interface.app.activity")}</h3>
              <Panel className="city-news">
                <div className="panel-title">
                  <h3>{copy("interface.app.wordOnTheBlock")}</h3>
                </div>
                {visibleEvents(s)
                  .filter(
                    (e) => e.category === "city" || e.category === "incident",
                  )
                  .slice()
                  .reverse()

                  .slice(0, 2)
                  .map((e) => (
                    <div className="news-item" key={e.id}>
                      <small>
                        {copy("interface.app.day6")}
                        {e.day}
                        {copy("interface.app.text13")}
                        {e.category.toUpperCase()}
                      </small>
                      <p>{e.text}</p>
                    </div>
                  ))}
              </Panel>
              <details className="panel situation-history">
                <summary>{copy("interface.app.completedStorylines")}</summary>
                {Object.values(s.incidents)
                  .filter((i) => i.status !== "active")
                  .map((i) => (
                    <div key={i.id}>
                      <h3>
                        {i.title}{" "}
                        <span className="status-chip">{i.status}</span>
                      </h3>
                      <p>
                        {i.status === "active"
                          ? `Demand ${money(i.demand)} · ${i.leadershipAware ? "Leadership is considering its response" : "No leadership intervention yet"}`
                          : `${i.resolution}. Life in The Stixx continues.`}
                      </p>
                      <p>
                        {s.commitments.find(
                          (c) =>
                            c.kind === "recover-property" &&
                            c.incidentId === i.id,
                        )?.status ??
                          (i.interventions.some((x) => x.actor === p.id)
                            ? "Resolved without a promise"
                            : "Resolved without your involvement")}
                      </p>
                      <details>
                        <summary>
                          {copy("interface.app.incidentRecord")}
                        </summary>
                        {visibleEvents(s)
                          .filter(
                            (e) =>
                              e.incidentId === i.id ||
                              e.id === i.resolvedEventId ||
                              i.interventions.some((x) => x.eventId === e.id),
                          )
                          .map((e) => (
                            <p key={e.id}>
                              <small>
                                {copy("interface.app.day7")}
                                {e.day}
                              </small>
                              {copy("interface.app.text14")}
                              {e.text}
                            </p>
                          ))}
                      </details>
                    </div>
                  ))}
              </details>
              <details className="panel outcome-history">
                <summary>
                  {copy("interface.app.importantOutcomes")}
                  {unseenEvents(s).length}
                  {copy("interface.app.unseen")}
                </summary>
                {importantEvents(s)
                  .slice()
                  .reverse()
                  .map((e) => (
                    <article key={e.id}>
                      <h3>{e.title ?? "Important development"}</h3>
                      <p>
                        {copy("interface.app.day8")}
                        {e.day}
                        {copy("interface.app.text15")}
                        {e.text}
                      </p>
                      {s.encounters.some((x) => x.sourceEventId === e.id) && (
                        <button
                          className="text-button"
                          onClick={() => replayReaction(e.id)}
                        >
                          {copy("interface.app.revisit")}{" "}
                          {(() => {
                            const id = s.encounters
                              .find((x) => x.sourceEventId === e.id)
                              ?.participants.find((id) => id !== p.id);
                            return id
                              ? (s.characters[id].alias ??
                                  s.characters[id].name)
                              : "this person";
                          })()}
                          {copy("interface.app.sReaction")}
                        </button>
                      )}
                    </article>
                  ))}
                {!importantEvents(s).length && (
                  <p>{copy("interface.app.noMajorOutcomesYet")}</p>
                )}
              </details>
              <div
                className="segmented"
                role="group"
                aria-label={copy("interface.app.activityFilters")}
              >
                <button
                  aria-pressed={activityFilter === "All"}
                  className={activityFilter === "All" ? "active" : ""}
                  onClick={() => setActivityFilter("All")}
                >
                  {copy("interface.app.allActivity")}
                </button>
                <button
                  aria-pressed={activityFilter === "Personal"}
                  className={activityFilter === "Personal" ? "active" : ""}
                  onClick={() => setActivityFilter("Personal")}
                >
                  {copy("interface.app.yourCircle")}
                </button>
              </div>
              <ActivityFeed s={s} personal={activityFilter === "Personal"} />
            </section>
          )}
          <details className="game-menu">
            <summary>{copy("interface.app.gameSaveInformation")}</summary>
            <p>
              {copy("interface.app.automaticProgressSavesAfterEachMoveSave")}
            </p>
            <p>
              {copy("interface.app.version01SeedState")}
              {s.rng}
              {copy("interface.app.noMaximumCampaignLength")}
            </p>
            <button
              className="secondary"
              onClick={() => {
                setState(null);
                setNotice(copy("interface.notice.chooseANameAndHomeForA"));
              }}
            >
              {copy("interface.app.newGameMenu")}
            </button>
          </details>
        </main>
        <nav
          className="bottom-nav"
          aria-label={copy("interface.app.mainNavigation")}
        >
          {(Object.keys(nav) as Screen[]).map((item) => (
            <button
              key={item}
              aria-label={
                {
                  City: copy("interface.navigation.city"),
                  People: copy("interface.navigation.people"),
                  Actions: copy("interface.navigation.actions"),
                  Set: copy("interface.navigation.set"),
                  Finances: copy("interface.navigation.wallet"),
                }[item]
              }
              className={screen === item ? "active" : ""}
              aria-current={screen === item ? "page" : undefined}
              onClick={() => {
                setScreen(item);
                if (item === "Actions") setGroup("Streets");
                setHistoryEncounterId(null);
                window.scrollTo(0, 0);
              }}
            >
              <Icon name={nav[item]} />
              <small>
                {
                  {
                    City: copy("interface.navigation.city"),
                    People: copy("interface.navigation.people"),
                    Actions: copy("interface.navigation.actions"),
                    Set: copy("interface.navigation.set"),
                    Finances: copy("interface.navigation.wallet"),
                  }[item]
                }
                {item === "City" && unseenEvents(s).length > 0 && (
                  <span
                    className="unseen-badge"
                    aria-label={`${unseenEvents(s).length} important developments waiting`}
                  >
                    {" "}
                    {copy("interface.app.text16")}
                    {unseenEvents(s).length}
                  </span>
                )}
              </small>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
