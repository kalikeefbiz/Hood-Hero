import { openCrewConversation } from "../systems/EncounterLifecycle";
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
import { advanceDay } from "../core/TimeSystem";
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
import { ANGELS_TRIO, CHAIN_EVIDENCE, artURL } from "./characterArt";
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
    [actionGroup, setGroup] = useState("Everyday"),
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
      setNotice("Local storage is unavailable. This tab can still run a game.");
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
    setNotice("You’re home. Find work, check on Cuzzo, or see who’s around.");
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
        setNotice(`Loaded day ${next.day}.`);
      } else setNotice("No saved game yet.");
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
        setNotice(`Saved day ${s.day}. Load restores this checkpoint.`);
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
      const reply = crewResponse
        ? (result.state.events.slice(s.events.length).at(-1)?.text ??
          (response === "details"
            ? "They shared more about their plans."
            : "Conversation concluded."))
        : response === "promise"
          ? "Cuzzo: ‘I’m counting on you.’ Your promise is recorded; recovery actions are in Actions → The Chains."
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
    setGroup("People");
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
  const incidentTypes: ActionType[] = [
    "negotiate",
    "settlement",
    "buyback",
    "recover",
    "favor",
  ];
  const socialTypes: ActionType[] = [
    "contact",
    "inquire",
    "introduce",
    "socialize",
    "offer",
    "transfer",
    "standing",
    "affiliate",
  ];
  let displayed = all.filter((a) =>
    actionGroup === "Everyday"
      ? [
          "work",
          "gig",
          "rest",
          "crime",
          "apply",
          "acceptJob",
          "timeOff",
          "resign",
        ].includes(a.type)
      : actionGroup === "The Chains"
        ? incidentTypes.includes(a.type)
          ? !a.target ||
            (a.type === "settlement" && a.target === "pablo") ||
            (a.type === "favor" && a.target === "mega")
          : ["contact", "inquire"].includes(a.type) && a.target === "mega"
        : a.target === person.id && socialTypes.includes(a.type),
  );
  displayed = displayed.filter((a) => {
    if (actionGroup === "Everyday") return true;
    if (actionGroup === "The Chains")
      return (
        ["contact", "inquire"].includes(a.type) || incident.status === "active"
      );
    return !["standing", "affiliate"].includes(a.type) || !!person.affiliation;
  });
  return (
    <div
      className={`game-shell screen-${screen.toLowerCase()}`}
      style={themeStyle(p.affiliation)}
      data-theme={p.affiliation ?? "independent"}
    >
      <a className="skip-link" href="#main-content">
        Skip to game
      </a>
      <aside className="desktop-brand">
        <p className="eyebrow">BLACKHOUSE PRESENTS</p>
        <h2>
          HOOD
          <br />
          HERO
        </h2>
        <p className="city-label">STIXX CITY</p>
        <div className="side-note">
          A city with a memory.
          <br />A life of your own.
        </div>
        <Scene zone={p.home} />
        <span className="sidebar-home">
          YOUR ROOTS / {s.zones[p.home].name}
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
              <small>YOUR MOVE</small>
              <p>{actionFeedback}</p>
            </div>
          )}
          <div className="screen-heading">
            <div>
              <p className="eyebrow">STIXX CITY / {screen.toUpperCase()}</p>
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
                setNotice(
                  `Day ${next.day}: living costs processed, the city has moved, and AP is restored.`,
                );
              }}
              disabled={!!s.end}
            >
              End day <span>→</span>
            </button>
          </div>
          {screen === "City" && dayTransition !== null && (
            <div className="day-transition" aria-hidden="true">
              DAY {dayTransition.toString().padStart(2, "0")} · The city has
              moved. Two AP restored.
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
              label="Character encounter"
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
                Continue conversation with Cuzzo
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
          {(screen === "City" || screen === "Actions") && (
            <CommitmentSummary s={s} />
          )}
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
                Your history remains available to inspect. Start a new life from
                the game menu below.
              </p>
            </Panel>
          )}
          {screen !== "City" && toast}
          {screen === "City" && (
            <>
              {activeStory && (
                <button
                  className="dispatch story-alert"
                  aria-label={`Open ${activeStory.title} in Actions`}
                  onClick={() => {
                    setGroup("The Chains");
                    setScreen("Actions");
                  }}
                >
                  <span className="dispatch-icon" aria-hidden="true">
                    <Icon name="message" />
                  </span>
                  <span>
                    <span className="eyebrow">WORD ON THE BLOCK</span>
                    <strong>{activeStory.title}</strong>
                    <span className="story-status">
                      Demand {money(activeStory.demand)} ·{" "}
                      {activeStory.leadershipAware
                        ? "Leadership is considering its response"
                        : "Awaiting your help"}
                    </span>
                  </span>
                  <Icon name="arrow" />
                </button>
              )}
              {toast}
              <div className="city-layout">
                <Panel className="map-panel">
                  <div className="panel-title">
                    <h3>Stixx City</h3>
                    <span className="map-key">● Your home</span>
                  </div>
                  <CityMap s={s} selected={selected} onSelect={setSelected} />
                  <ul className="map-legend" aria-label="Faction colors">
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
                    Select a neighborhood to read its politics. Split colors
                    show shared presence; gray is unclaimed.
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
                      Control:{" "}
                      {s.zones[selected].controller
                        ? s.factions[s.zones[selected].controller!].name
                        : "No single controller"}
                    </p>
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
                        <span>Unclaimed</span>
                      )}
                    </div>
                    <Meter
                      label="Police presence"
                      value={s.zones[selected].police}
                      description={band(s.zones[selected].police, [
                        "Minimal",
                        "Light",
                        "Elevated",
                        "Heavy",
                      ])}
                    />
                    <Meter
                      label="Your local standing"
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
                      Meet local people →
                    </button>
                  </Panel>
                </div>
              </div>
              <EmploymentSummary s={s} />
              <Panel>
                <div className="panel-title">
                  <h3>Your position</h3>
                  <span className="eyebrow">SEPARATE REPUTATIONS</span>
                </div>
                <div className="meters">
                  <Meter
                    label="Stress"
                    value={p.stress}
                    description={band(p.stress, [
                      "At ease",
                      "Managing",
                      "Strained",
                      "Overwhelmed",
                    ])}
                  />
                  <Meter
                    label="Legitimacy"
                    value={p.legitimacy}
                    description={band(p.legitimacy, [
                      "Unestablished",
                      "Credible",
                      "Respected",
                      "Established",
                    ])}
                  />
                  <Meter
                    label="Notoriety"
                    value={p.notoriety}
                    description={band(p.notoriety, [
                      "Under the radar",
                      "Recognized",
                      "Talked about",
                      "Notorious",
                    ])}
                  />
                  <Meter
                    label="Police attention"
                    value={p.police}
                    description={band(p.police, [
                      "Quiet",
                      "Noticed",
                      "Under scrutiny",
                      "In danger",
                    ])}
                  />
                  <Meter
                    label="Personal influence"
                    value={p.influence}
                    description={band(p.influence, [
                      "Small circle",
                      "Connected",
                      "Influential",
                      "Well established",
                    ])}
                  />
                  <Meter
                    label="Rival pressure"
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
                            · {c.status}
                          </small>
                        </span>
                        <span>›</span>
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
                  {person.alias && <small> / {person.alias}</small>}
                </h3>
                <p>{person.description}</p>
                <p className="muted">{knownCapabilities(person)}</p>
                {s.crew.members.includes(person.id) && (
                  <button
                    className="secondary"
                    onClick={() => interact(person.id)}
                  >
                    Interact with {person.name}
                  </button>
                )}
                <p className="muted">
                  {person.status === "active"
                    ? person.availableDay > s.day
                      ? "Currently committed elsewhere."
                      : "Available to contact."
                    : "Currently " + person.status + "."}
                </p>
                <Meter
                  label="Their trust in you"
                  value={person.relationships[p.id]?.trust ?? 0}
                  description={band(person.relationships[p.id]?.trust ?? 0, [
                    "Wary",
                    "Acquainted",
                    "Trusting",
                    "Close",
                  ])}
                />
                <Meter
                  label="Your trust in them"
                  value={p.relationships[person.id]?.trust ?? 0}
                  description={band(p.relationships[person.id]?.trust ?? 0, [
                    "Wary",
                    "Acquainted",
                    "Trusting",
                    "Close",
                  ])}
                />
                <p className="muted">
                  Work {person.skills.work} · Social {person.skills.social} ·
                  Recovery {person.skills.recovery}
                </p>
                <button
                  className="primary"
                  onClick={() => openPerson(person.id)}
                >
                  Interact with {person.alias ?? person.name} →
                </button>
                <h4>Your shared history</h4>
                {p.memories
                  .filter((m) => m.about === person.id)
                  .slice(-4)
                  .reverse()
                  .map((m, i) => (
                    <p className="memory" key={i}>
                      <small>DAY {m.day}</small>
                      {m.meaning}
                    </p>
                  ))}
                {!p.memories.some((m) => m.about === person.id) && (
                  <p className="muted">
                    You have not shared a significant event yet.
                  </p>
                )}
                <h4>Events you witnessed</h4>
                {visibleEvents(s)
                  .filter((e) => e.actors.includes(person.id))
                  .slice(-4)
                  .reverse()
                  .map((e) => (
                    <p className="memory" key={e.id}>
                      <small>DAY {e.day}</small>
                      {e.text}
                    </p>
                  ))}
              </Panel>
            </div>
          )}
          {screen === "Actions" && (
            <>
              <div className="segmented" aria-label="Action categories">
                {["Everyday", "The Chains", "People"].map((group) => (
                  <button
                    key={group}
                    aria-pressed={actionGroup === group}
                    className={actionGroup === group ? "active" : ""}
                    onClick={() => setGroup(group)}
                  >
                    {group}
                  </button>
                ))}
              </div>
              {actionGroup === "Everyday" && <EmploymentSummary s={s} />}
              {actionGroup === "The Chains" && (
                <Panel className="situation">
                  <div className="panel-title">
                    <h3>The Chains</h3>
                    <span className="status-chip">{incident.status}</span>
                  </div>
                  <p>
                    {incident.status === "active"
                      ? `Mega’s property is held jointly by Dizzy, Baby Canon and Joker. Current demand: ${money(incident.demand)}. ${incident.informed ? "The robbery was unauthorized." : "Speak to Cuzzo to understand the situation."}`
                      : `Resolution: ${incident.resolution}. The owner’s history and everyone’s memories persist.`}
                  </p>
                  <div className="tags">
                    <span>Owner: Mega</span>
                    <span>
                      {incident.escalation < 40
                        ? "Tension: unsettled"
                        : "Tension: escalating"}
                    </span>
                    {incident.leadershipAware && (
                      <span>Leadership informed</span>
                    )}
                  </div>
                  <p className="muted">
                    No obligation to intervene. You can work, build
                    relationships, or end the day at any time.
                  </p>
                </Panel>
              )}
              {actionGroup === "The Chains" && incident?.informed && (
                <div className="story-evidence">
                  <figure>
                    <img
                      src={artURL(CHAIN_EVIDENCE.path)}
                      alt={CHAIN_EVIDENCE.alt}
                      width={CHAIN_EVIDENCE.width}
                      height={CHAIN_EVIDENCE.height}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.hidden = true;
                      }}
                    />
                    <figcaption>
                      Mega’s missing jewelry. Item reference; current custody
                      follows the incident.
                    </figcaption>
                  </figure>
                  <figure>
                    <img
                      src={artURL(ANGELS_TRIO.path)}
                      alt={ANGELS_TRIO.alt}
                      width={ANGELS_TRIO.width}
                      height={ANGELS_TRIO.height}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.hidden = true;
                      }}
                    />
                    <figcaption>
                      Baby Canon · Joker · Dizzy. The three young Angels Mega
                      identified.
                    </figcaption>
                  </figure>
                </div>
              )}
              {actionGroup === "People" && (
                <label className="person-selector">
                  Contact
                  <select
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                  >
                    {p.known
                      .filter((id) => s.characters[id] && id !== p.id)
                      .map((id) => (
                        <option key={id} value={id}>
                          {s.characters[id].alias ?? s.characters[id].name}
                        </option>
                      ))}
                  </select>
                  <small>
                    They feel{" "}
                    {band(person.relationships[p.id]?.trust ?? 0, [
                      "wary",
                      "acquainted",
                      "trusting",
                      "close",
                    ])}{" "}
                    toward you. Known contacts can be reached across zones.
                  </small>
                </label>
              )}
              <div className="action-grid">{displayed.map(actionCard)}</div>
              {!displayed.length && (
                <Panel>
                  <p>
                    No further interactions here right now. Everyday work, rest
                    and the rest of the city are still available.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setGroup("Everyday")}
                  >
                    Find everyday opportunities →
                  </button>
                </Panel>
              )}
            </>
          )}
          {screen === "Set" && (
            <>
              <Panel>
                <div className="panel-title">
                  <h3>A personal crew.</h3>
                  <span className="status-chip">
                    {s.crew.members.length}/{s.crew.capacity} MEMBERS
                  </span>
                </div>
                <p>
                  Your Set is a circle of up to five trusted people, distinct
                  from the city’s five organizations. Influence expands capacity
                  at 5, 15, 30 and 50.
                </p>
                <p className="muted">
                  Current influence: {Math.floor(p.influence)}. Members keep
                  their own affiliations, resources and memories.
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
                            · Work {c.skills.work}
                          </small>
                        </div>
                      </div>
                      <p>{c.description}</p>
                      <Meter
                        label="Their trust in you"
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
                        Interact with {c.name}
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
                            {ACTIONS[type].label} · 1 AP
                            {reason ? ` · ${reason}` : ""}
                          </button>
                        );
                      })}
                    </Panel>
                  );
                })}
              </div>
              <Panel>
                <h3>Plans & opportunities</h3>
                {s.crewOffers
                  .filter((o) => o.status === "pending")
                  .map((o) => (
                    <p key={o.id}>
                      {s.characters[o.member].name} · invitation for day{" "}
                      {o.activityDay}{" "}
                      <button
                        className="secondary"
                        onClick={() => {
                          const e = s.encounters.find(
                            (e) => e.crewOfferId === o.id,
                          );
                          if (e) showConversation(e.id);
                        }}
                      >
                        Hear the offer
                      </button>
                    </p>
                  ))}
                {s.assignments
                  .filter((a) => ["accepted", "active"].includes(a.status))
                  .map((a) => (
                    <p key={a.id}>
                      {s.characters[a.member].name} · {a.objective} · {a.status}{" "}
                      · day {a.dueDay}
                      {a.status === "accepted" && (
                        <button
                          className="secondary"
                          onClick={() => interact(a.member)}
                        >
                          Meet for scheduled activity
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
                    No plans yet. Talk with a member; they also bring ideas when
                    their own lives allow.
                  </p>
                )}
              </Panel>
              <h3>People you could ask</h3>
              <p className="muted">
                Available people need 42 trust, compatible loyalties, and an
                open place.
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
                            Trust{" "}
                            {Math.round(c.relationships[p.id]?.trust ?? 0)} ·{" "}
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
                          Invite
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
              <h3>Set errands</h3>
              {s.commitments
                .filter((c) => c.kind === "errand")
                .slice(-5)
                .reverse()
                .map((o) => (
                  <p className="memory" key={o.id}>
                    {s.characters[o.actor].name} · Local errand · Due day{" "}
                    {o.dueDay} · {o.status}
                  </p>
                ))}
              {!s.commitments.length && (
                <p className="muted">
                  Assign a member to a paid errand. Their availability is
                  reserved until it is processed.
                </p>
              )}
            </>
          )}
          {screen === "Finances" && (
            <>
              <EmploymentSummary s={s} />
              <Panel>
                <p className="eyebrow">CASH ON HAND</p>
                <h3 className="cash-total">{money(cash(p))}</h3>
                <div className="finance-split">
                  <span>
                    <small>CLEAN</small>
                    <strong>{money(p.wallet.clean)}</strong>
                  </span>
                  <span>
                    <small>ILLICIT</small>
                    <strong>{money(p.wallet.illicit)}</strong>
                  </span>
                  <span>
                    <small>DAILY LIVING</small>
                    <strong>{money(BALANCE.livingCost)}</strong>
                  </span>
                </div>
                <p>
                  {ACTIONS.work.description} {ACTIONS.gig.description} Living
                  expenses are charged as you advance each day.
                </p>
                <p className="muted">
                  Clean and illicit funds keep separate provenance. Purchases
                  use clean money first. Running short increases stress; it
                  never locks you out of work.
                </p>
              </Panel>
              <h3>Personal purchases</h3>
              <div className="action-grid">
                {all.filter((a) => a.type === "buy").map(actionCard)}
              </div>
              <Panel>
                <h3>Money trail</h3>
                {s.ledger
                  .slice(-20)
                  .reverse()
                  .map((entry, i) => (
                    <div className="ledger" key={i}>
                      <span>
                        <strong>{entry.reason}</strong>
                        <small>
                          DAY {entry.day} · {entry.provenance.toUpperCase()}
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
                    Your first $125 is clean starting cash. Future transactions
                    appear here.
                  </p>
                )}
              </Panel>
            </>
          )}
          {screen === "City" && (
            <section id="city-activity" aria-labelledby="city-activity-title">
              <h3 id="city-activity-title">Activity</h3>
              <Panel className="city-news">
                <div className="panel-title">
                  <h3>Word on the block</h3>
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
                        DAY {e.day} / {e.category.toUpperCase()}
                      </small>
                      <p>{e.text}</p>
                    </div>
                  ))}
              </Panel>
              <details className="panel situation-history">
                <summary>Situation history</summary>
                {Object.values(s.incidents).map((i) => (
                  <div key={i.id}>
                    <h3>
                      {i.title} <span className="status-chip">{i.status}</span>
                    </h3>
                    <p>
                      {i.status === "active"
                        ? `Demand ${money(i.demand)} · ${i.leadershipAware ? "Leadership is considering its response" : "No leadership intervention yet"}`
                        : `${i.resolution}. Life in The Stixx continues.`}
                    </p>
                    <details>
                      <summary>Incident record</summary>
                      {visibleEvents(s)
                        .filter(
                          (e) =>
                            e.incidentId === i.id ||
                            e.id === i.resolvedEventId ||
                            i.interventions.some((x) => x.eventId === e.id),
                        )
                        .map((e) => (
                          <p key={e.id}>
                            <small>DAY {e.day}</small> · {e.text}
                          </p>
                        ))}
                    </details>
                  </div>
                ))}
              </details>
              <details className="panel outcome-history">
                <summary>
                  Important outcomes · {unseenEvents(s).length} unseen
                </summary>
                {importantEvents(s)
                  .slice()
                  .reverse()
                  .map((e) => (
                    <article key={e.id}>
                      <h3>{e.title ?? "Important development"}</h3>
                      <p>
                        DAY {e.day} · {e.text}
                      </p>
                      {s.encounters.some((x) => x.sourceEventId === e.id) && (
                        <button
                          className="text-button"
                          onClick={() => replayReaction(e.id)}
                        >
                          Revisit Cuzzo’s reaction
                        </button>
                      )}
                    </article>
                  ))}
                {!importantEvents(s).length && <p>No major outcomes yet.</p>}
              </details>
              <div
                className="segmented"
                role="group"
                aria-label="Activity filters"
              >
                <button
                  aria-pressed={activityFilter === "All"}
                  className={activityFilter === "All" ? "active" : ""}
                  onClick={() => setActivityFilter("All")}
                >
                  All activity
                </button>
                <button
                  aria-pressed={activityFilter === "Personal"}
                  className={activityFilter === "Personal" ? "active" : ""}
                  onClick={() => setActivityFilter("Personal")}
                >
                  Your circle
                </button>
              </div>
              <ActivityFeed s={s} personal={activityFilter === "Personal"} />
            </section>
          )}
          <details className="game-menu">
            <summary>Game & save information</summary>
            <p>
              Automatic progress saves after each move. Save creates a manual
              checkpoint. Load restores that checkpoint, then falls back to
              autosave. Resume opens your latest automatic progress, including
              acknowledged outcomes. Saves stay in this browser on this device.
            </p>
            <p>
              Version 0.1 · Seed state {s.rng} · No maximum campaign length.
            </p>
            <button
              className="secondary"
              onClick={() => {
                setState(null);
                setNotice(
                  "Choose a name and home for a new game, or resume your saved checkpoint.",
                );
              }}
            >
              New game menu
            </button>
          </details>
        </main>
        <nav className="bottom-nav" aria-label="Main navigation">
          {(Object.keys(nav) as Screen[]).map((item) => (
            <button
              key={item}
              aria-label={item === "Finances" ? "Wallet" : item}
              className={screen === item ? "active" : ""}
              aria-current={screen === item ? "page" : undefined}
              onClick={() => {
                setScreen(item);
                setHistoryEncounterId(null);
                window.scrollTo(0, 0);
              }}
            >
              <Icon name={nav[item]} />
              <small>
                {item === "Finances" ? "Wallet" : item}
                {item === "City" && unseenEvents(s).length > 0 && (
                  <span
                    className="unseen-badge"
                    aria-label={`${unseenEvents(s).length} important developments waiting`}
                  >
                    {" "}
                    · {unseenEvents(s).length}
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
