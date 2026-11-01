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
import { visibleEvents } from "../core/EventLog";
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
type Screen = "City" | "People" | "Actions" | "Set" | "Finances" | "Activity";
const nav: Record<Screen, IconName> = {
  City: "City",
  People: "People",
  Actions: "Actions",
  Set: "Set",
  Finances: "Finances",
  Activity: "Activity",
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
    const next = newGame(name, home);
    setState(next);
    setSelected(home);
    setScreen("City");
    setNotice("You’re home. Clock in, check on Cuzzo, or see who’s around.");
  }
  function load() {
    try {
      const next = loadGame(localStorage) || loadGame(localStorage, AUTO_KEY);
      if (next) {
        setState(next);
        setSelected(player(next).home);
        setScreen("City");
        setNotice(`Loaded day ${next.day}.`);
      } else setNotice("No saved game yet.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function save() {
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
    if (result.error) setNotice(result.error);
    else {
      setState(result.state);
      setNotice(
        visibleEvents(result.state).at(-1)?.text ?? "Action completed.",
      );
    }
  }
  function openPerson(id: string) {
    setFocus(id);
    setGroup("People");
    setScreen("Actions");
  }
  const toast = (
    <div className="notice" role="status" aria-live="polite">
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
        load={load}
        hasSave={hasSave}
        feedback={toast}
      />
    );
  const p = player(s),
    incident = s.incidents["the-chains"],
    person = s.characters[focus] ?? s.characters.mega;
  const all = availableActions(s);
  const actionCard = (a: Action) => (
    <ActionCard
      key={`${a.type}-${a.target ?? a.item ?? ""}`}
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
      ? ["work", "gig", "rest", "crime"].includes(a.type)
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
          load={load}
        />
        <main className="main-content" id="main-content">
          <div className="screen-heading">
            <div>
              <p className="eyebrow">STIXX CITY / {screen.toUpperCase()}</p>
              <h2>
                {screen === "City"
                  ? "Today’s moves"
                  : screen === "People"
                    ? "People remember."
                    : screen === "Actions"
                      ? "Make your next move."
                      : screen === "Set"
                        ? "Your people. Your Set."
                        : screen === "Finances"
                          ? "Keep yourself afloat."
                          : "Word on the block."}
              </h2>
            </div>
            <button
              className="advance"
              onClick={() => {
                const next = advanceDay(s);
                setState(next);
                setNotice(
                  `Day ${next.day}: living costs processed, the city has moved, and AP is restored.`,
                );
              }}
              disabled={!!s.end}
            >
              End day <span>→</span>
            </button>
          </div>
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
              <div className="hub-layout">
                <section className="today-moves">
                  <div className="quick-moves">
                    {all
                      .filter(
                        (a) =>
                          ["work", "gig"].includes(a.type) ||
                          (a.type === "contact" && a.target === "mega"),
                      )
                      .map((a) => (
                        <ActionCard
                          key={a.type}
                          s={s}
                          action={a}
                          onAction={act}
                          compact
                        />
                      ))}
                  </div>
                </section>
                <section className="dispatch" aria-label="Current situation">
                  <span className="dispatch-icon">
                    <Icon name="message" />
                  </span>
                  <div>
                    <p className="eyebrow">
                      CUZZO /{" "}
                      <span className="status-chip">{incident.status}</span>
                    </p>
                    <h3>The Chains</h3>
                    <p>
                      {incident.status === "active"
                        ? `“They want bread for my chains. Hit me.” Demand ${money(incident.demand)}.`
                        : "The dispute is over. Life in the city continues."}
                    </p>
                  </div>
                  <button
                    aria-label={
                      incident.status === "active"
                        ? "See the situation"
                        : "Find your next move"
                    }
                    onClick={() => {
                      setGroup(
                        incident.status === "active"
                          ? "The Chains"
                          : "Everyday",
                      );
                      setScreen("Actions");
                    }}
                  >
                    <Icon name="arrow" />
                  </button>
                </section>
              </div>
              {toast}
              <Panel className="city-news">
                <div className="panel-title">
                  <h3>Word on the block</h3>
                  <button
                    className="text-button"
                    onClick={() => setScreen("Activity")}
                  >
                    Open log <Icon name="arrow" />
                  </button>
                </div>
                {visibleEvents(s)
                  .filter(
                    (e) => e.category === "city" || e.category === "incident",
                  )
                  .slice(-2)
                  .reverse()
                  .map((e) => (
                    <div className="news-item" key={e.id}>
                      <small>
                        DAY {e.day} / {e.category.toUpperCase()}
                      </small>
                      <p>{e.text}</p>
                    </div>
                  ))}
              </Panel>
              <div className="city-layout">
                <Panel className="map-panel">
                  <div className="panel-title">
                    <span className="eyebrow">FIVE NEIGHBORHOODS</span>
                    <span className="map-key">● Your home</span>
                  </div>
                  <CityMap s={s} selected={selected} onSelect={setSelected} />
                  <p className="caption">
                    Select a neighborhood to read its politics.
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
                <Portrait c={person} />
                <p className="eyebrow">{s.zones[person.home].name}</p>
                <h3>
                  {person.name}
                  {person.alias && <small> / {person.alias}</small>}
                </h3>
                <p>{person.description}</p>
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
                        <Portrait c={c} />
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
                      <p className="outcome">
                        Paid errand: possible ${BALANCE.errandIncome} clean
                        income on the next day; can fail.
                      </p>
                      {(["assign", "remove"] as ActionType[]).map((type) => {
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
              <h3>Commitments</h3>
              {s.commitments
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
          {screen === "Activity" && (
            <>
              <Panel>
                <p className="eyebrow">ACTIVE SITUATIONS</p>
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
                  </div>
                ))}
              </Panel>
              <div className="segmented">
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
              <div className="timeline">
                {visibleEvents(s)
                  .filter(
                    (e) => activityFilter === "All" || e.category !== "city",
                  )
                  .slice(-80)
                  .reverse()
                  .map((e, index, events) => (
                    <article
                      key={e.id}
                      className={
                        index === 0 || events[index - 1].day !== e.day
                          ? "day-start"
                          : ""
                      }
                    >
                      {(index === 0 || events[index - 1].day !== e.day) && (
                        <h3 className="timeline-day">
                          Day {e.day.toString().padStart(2, "0")}
                        </h3>
                      )}
                      <span className="timeline-dot" />
                      <div>
                        <small>
                          DAY {e.day} <span> / {e.category.toUpperCase()}</span>
                        </small>
                        <p>{e.text}</p>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          <details className="game-menu">
            <summary>Game & save information</summary>
            <p>
              Automatic progress saves after each move. Save creates a manual
              checkpoint; Load and Resume prefer that checkpoint, then autosave.
              Saves stay in this browser on this device.
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
              className={screen === item ? "active" : ""}
              aria-current={screen === item ? "page" : undefined}
              onClick={() => {
                setScreen(item);
                window.scrollTo(0, 0);
              }}
            >
              <Icon name={nav[item]} />
              <small>{item === "Finances" ? "Wallet" : item}</small>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
