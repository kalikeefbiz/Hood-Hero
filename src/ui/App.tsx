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
import { BoardBackdrop } from "../board/ui/Board";
import {
  AppearancePanel,
  BlockSheet,
  BoardControls,
  DistrictChips,
  DistrictPlaces,
  PersonInspector,
  PlaceSheet,
  PresenceCard,
} from "../board/ui/BoardPanels";
import { deriveBoardView } from "../board/viewModel";
import { BoardHUD } from "../board/ui/BoardHUD";
import { moveTo, presenceOf, setAppearance } from "../board/presence";
import { boardPeople } from "../board/people";
import { pulseDay, walkTo } from "../board/bus";
import type { Popup } from "../board/ui/BoardStage";
import type { Focus, Lens, TimeOfDay } from "../board/BoardRenderer";
import { locationBlock } from "../city3d/layout";
import { LOCATIONS, locationById } from "../board/locations";
const LOCATIONS_BY_INCIDENT: Record<string, string> = Object.fromEntries(
  LOCATIONS.filter((l) => l.links.incident).map((l) => [
    l.links.incident!,
    l.id,
  ]),
);
import { StreetWork } from "./StreetWork";
import { useMemo, useRef } from "react";
import { NewRun } from "./NewRun";
import { GameHUD } from "./GameHUD";
import { ActionCard, money } from "./ActionCard";
import { Scene } from "./Scene";
import { Icon, type IconName } from "./Icon";
import { themeStyle } from "./theme";
import { THEMES } from "./theme";
import { BALANCE } from "../content/balance";
type Screen = "City" | "People" | "Actions" | "Set" | "Finances" | "Journal";
const nav: Record<Screen, IconName> = {
  City: "City",
  People: "People",
  Actions: "Actions",
  Set: "Set",
  Finances: "Finances",
  Journal: "message",
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
  // Strategy board: what the camera is focused on, how the city is read.
  const [board, setBoard] = useState<Focus>({
    zone: null,
    block: null,
    place: null,
  });
  const [lens, setLens] = useState<Lens>("streets");
  const [time, setTime] = useState<TimeOfDay>(() => {
    try {
      const t = localStorage.getItem("hoodhero-lab.time");
      return t === "night" || t === "day" ? t : "dusk";
    } catch {
      return "dusk";
    }
  });
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [lookOpen, setLookOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [popups, setPopups] = useState<Popup[]>([]);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const boardView = useMemo(() => (s ? deriveBoardView(s) : null), [s]);
  const people = useMemo(() => (s ? boardPeople(s) : []), [s]);
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
    // Keep the board's focus inside the space the HUD and sheet leave free.
    const measure = () => {
      const top = hudRef.current?.getBoundingClientRect().bottom ?? 0;
      const r = sheetRef.current?.getBoundingClientRect();
      // On wide screens the sheet is a side panel and leaves the height free.
      const bottom = r && r.left < 10 ? window.innerHeight - r.top : 0;
      setInsets({ top: Math.max(0, top), bottom: Math.max(0, bottom) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (sheetRef.current) ro.observe(sheetRef.current);
    if (hudRef.current) ro.observe(hudRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [!!s, screen, board.place, board.block, board.zone, personId, lookOpen]);
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
    setBoard({ zone: home, block: null, place: null });
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
        setBoard({ zone: player(next).home, block: null, place: null });
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
  function act(a: Action, at?: string) {
    if (!s) return;
    const result = performAction(s, a);
    if (result.error) {
      setNotice(result.error);
      setActionFeedback(result.error);
    } else {
      // On the board, acting somewhere means being there.
      const next = at ? moveTo(result.state, at) : result.state;
      setState(next);
      if (at) {
        const diff = cash(player(next)) - cash(player(s));
        const id = Date.now();
        setPopups((list) => [
          ...list,
          {
            id,
            placeId: at,
            text: diff ? `${diff > 0 ? "+" : "−"}$${Math.abs(diff)}` : "✓",
            tone: diff > 0 ? "good" : diff < 0 ? "bad" : "neutral",
          },
        ]);
        window.setTimeout(
          () => setPopups((list) => list.filter((x) => x.id !== id)),
          2600,
        );
      }
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
  const meetLocals = (zone: ZoneId) => {
    const local = p.known.find((id) => s.characters[id]?.home === zone);
    if (local) setFocus(local);
    setScreen("People");
    window.scrollTo(0, 0);
  };
  /** The player walks to the place first, then the existing action runs. */
  async function actAt(a: Action, placeId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await walkTo(placeId);
    } finally {
      setBusy(false);
    }
    act(a, placeId);
  }
  async function goHere(placeId: string) {
    if (busy || !s) return;
    setBusy(true);
    try {
      await walkTo(placeId);
    } finally {
      setBusy(false);
    }
    setState((cur) => (cur ? moveTo(cur, placeId) : cur));
  }
  const boardTile = (a: Action, placeId: string) => (
    <ActionCard
      key={`${a.type}-${a.target ?? a.item ?? a.jobId ?? ""}`}
      s={s}
      action={a}
      compact
      onAction={(x) => void actAt(x, placeId)}
    />
  );
  function endDay() {
    if (!s) return;
    const warning = absenceWarning(s);
    if (warning && !window.confirm(warning + " End day anyway?")) return;
    setActionFeedback(null);
    const next = advanceDay(s);
    setState(next);
    setScreen("City");
    setHistoryEncounterId(null);
    window.scrollTo(0, 0);
    setDayTransition(next.day);
    pulseDay();
    setNotice(
      `Day ${next.day}: living costs processed, the city has moved, and AP is restored.`,
    );
  }
  /** Move the board's focus; the City sheet follows it. */
  const focusBoard = (f: Focus) => {
    const place = f.place ? locationById(f.place) : null;
    const next: Focus = place
      ? {
          zone: place.zone,
          block: locationBlock(place)?.id ?? null,
          place: place.id,
        }
      : f;
    setBoard(next);
    setPersonId(null);
    setLookOpen(false);
    if (next.zone) setSelected(next.zone);
    setScreen("City");
    setHistoryEncounterId(null);
    sheetRef.current?.scrollTo({ top: 0 });
  };
  const showPolitics = (zone: ZoneId) => {
    setSelected(zone);
    requestAnimationFrame(() =>
      document
        .querySelector(".zone-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const openPeople = (id: string) => {
    setFocus(id);
    setScreen("People");
  };
  // Run endings and custody are shown wherever the player is looking.
  const alerts = (
    <>
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
              ? s.events.find((e) => e.id === s.strategic.ending?.eventId)?.text
              : ""}{" "}
            Your history remains available to inspect. Start a new life from the
            game menu below.
          </p>
        </Panel>
      )}
      {p.status === "arrested" && (
        <Panel>
          <h3>In custody</h3>
          <p>
            Release day{" "}
            {s.street.custody.find(
              (r) => r.character === p.id && r.status === "held",
            )?.releaseDay ?? "not defined"}
            . Street actions and ordinary work are unavailable. Each day still
            resolves living costs, employment, supplier obligations, crew and
            city activity.
          </p>
          <button
            onClick={() => {
              setState(serveSentence(s));
              setScreen("City");
            }}
          >
            Serve remaining sentence
          </button>
        </Panel>
      )}
    </>
  );
  return (
    <div
      className={`game-shell board-mode screen-${screen.toLowerCase()} ${screen !== "City" ? "ledger-open" : ""}`}
      style={{ ...themeStyle(null), ["--hud-h" as string]: `${insets.top}px` }}
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
      {boardView && (
        <BoardBackdrop
          s={s}
          view={boardView}
          focus={board}
          onPick={(f) =>
            f.zone
              ? focusBoard(f)
              : focusBoard({ zone: null, block: null, place: null })
          }
          lens={lens}
          time={time}
          insets={insets}
          onInteract={() => screen !== "City" && setScreen("City")}
          people={people}
          personId={personId}
          onPerson={(id) => {
            const at = people.find((x) => x.id === id);
            const l = at ? locationById(at.placeId) : null;
            if (l)
              setBoard({
                zone: l.zone,
                block: locationBlock(l)?.id ?? null,
                place: null,
              });
            setPersonId(id);
            setLookOpen(false);
            setScreen("City");
          }}
          playerAt={presenceOf(s).location}
          appearance={presenceOf(s).appearance}
          accent={THEMES[p.affiliation ?? "independent"].secondary}
          story={
            activeStory
              ? {
                  placeId:
                    LOCATIONS_BY_INCIDENT[activeStory.id] ??
                    presenceOf(s).location,
                  title: activeStory.title,
                }
              : null
          }
          onStory={() =>
            activeStory && setState(openStoryline(s, activeStory.id))
          }
          popups={popups}
        />
      )}
      <div className="game-body">
        <div className="board-top" ref={hudRef}>
          <BoardHUD
            s={s}
            save={save}
            load={() => load(false)}
            onLook={() => {
              setScreen("City");
              setLookOpen(true);
            }}
          />
          {screen === "City" && (
            <BoardControls
              s={s}
              endDay={endDay}
              focus={board}
              setFocus={focusBoard}
              lens={lens}
              setLens={setLens}
              time={time}
              setTime={(t) => {
                setTime(t);
                try {
                  localStorage.setItem("hoodhero-lab.time", t);
                } catch {
                  /* preference only */
                }
              }}
            />
          )}
          {screen === "City" &&
            !board.place &&
            !board.block &&
            !personId &&
            !lookOpen && (
              <DistrictChips s={s} focus={board} setFocus={focusBoard} />
            )}
          {screen === "City" && <div className="board-notice">{toast}</div>}
          {screen === "City" && !presented && (
            <div className="board-story-strip">
              {activeStory && (
                <button
                  className="story-alert"
                  aria-label={`Open ${activeStory.title} storyline`}
                  onClick={() => setState(openStoryline(s, activeStory.id))}
                >
                  <span aria-hidden="true">!</span>
                  <strong>{activeStory.title}</strong>
                  <span className="story-status">
                    Demand {money(activeStory.demand)} ·{" "}
                    {activeStory.leadershipAware
                      ? "Leadership is considering its response"
                      : "Awaiting your help"}
                  </span>
                </button>
              )}
              {request && (
                <button
                  className="secondary"
                  onClick={() => showConversation(request.id)}
                >
                  Continue conversation with Cuzzo
                </button>
              )}
              {s.encounters
                .filter(
                  (e) =>
                    ["workplace", "crew-offer"].includes(e.definitionId) &&
                    e.status === "pending",
                )
                .map((e) => (
                  <button
                    className="secondary"
                    key={e.id}
                    onClick={() => showConversation(e.id)}
                  >
                    {e.definitionId === "crew-offer"
                      ? `Hear from ${s.characters[e.participants[0]].name}`
                      : "Resume workplace conversation"}
                  </button>
                ))}
            </div>
          )}
        </div>
        {actionFeedback && (
          <div className="action-feedback" role="status" aria-live="polite">
            <small>YOUR MOVE</small>
            <p>{actionFeedback}</p>
          </div>
        )}
        {screen === "City" && dayTransition !== null && (
          <div className="day-transition" aria-hidden="true">
            DAY {dayTransition.toString().padStart(2, "0")} · The city has
            moved. Two AP restored.
          </div>
        )}
        {screen === "City" && !presented && (
          <div className="board-news">
            <NarrativeNotifications
              s={s}
              acknowledge={(id) => {
                const next = acknowledgeEvent(s, id);
                syncEncounters(next);
                setState(next);
              }}
              view={viewReaction}
            />
          </div>
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
        {screen === "City" && (
          <div className="board-inspector" ref={sheetRef}>
            {alerts}
            {lookOpen ? (
              <AppearancePanel
                appearance={presenceOf(s).appearance}
                onChange={(a) => setState(setAppearance(s, a))}
                onClose={() => setLookOpen(false)}
              />
            ) : personId ? (
              <PersonInspector
                s={s}
                personId={personId}
                renderAction={(a) =>
                  boardTile(
                    a,
                    people.find((x) => x.id === personId)?.placeId ??
                      presenceOf(s).location,
                  )
                }
                openProfile={openPeople}
              />
            ) : board.place && boardView ? (
              <PlaceSheet
                s={s}
                view={boardView}
                placeId={board.place}
                renderAction={(a) => boardTile(a, board.place!)}
                renderStreet={() => (
                  <StreetWork
                    s={s}
                    sell={(market) =>
                      actAt(
                        { type: "crime", actor: p.id, market },
                        board.place!,
                      )
                    }
                    connects={() => {
                      setGroup("Connects");
                      setScreen("Actions");
                    }}
                  />
                )}
                openPerson={(id) => setPersonId(id)}
                showPolitics={showPolitics}
                setState={setState}
                openStoryline={
                  activeStory
                    ? () => setState(openStoryline(s, activeStory.id))
                    : undefined
                }
                goHere={() => goHere(board.place!)}
                busy={busy}
              />
            ) : board.block && boardView ? (
              <BlockSheet
                s={s}
                view={boardView}
                blockId={board.block}
                setFocus={focusBoard}
              />
            ) : board.zone && boardView ? (
              <>
                <div className="city-layout board-district">
                  <div className="zone-details">
                    <Panel>
                      <span className="eyebrow">
                        {s.zones[selected].subtitle}
                      </span>
                      <h3>{s.zones[selected].name}</h3>
                      <p>
                        {selected === "reservoir"
                          ? ZONES.reservoir.description
                          : s.zones[selected].description}
                      </p>
                      <p className="control-label">
                        Control:{" "}
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
                        onClick={() => meetLocals(selected)}
                      >
                        Meet local people →
                      </button>
                    </Panel>
                  </div>
                </div>

                <DistrictPlaces
                  s={s}
                  view={boardView}
                  zone={board.zone}
                  setFocus={focusBoard}
                />
              </>
            ) : (
              <PresenceCard
                s={s}
                onFind={() =>
                  focusBoard({
                    zone: null,
                    block: null,
                    place: presenceOf(s).location,
                  })
                }
                onLook={() => setLookOpen(true)}
              />
            )}
          </div>
        )}
        <div className="board-dock">
          <nav className="bottom-nav" aria-label="Main navigation">
            {(Object.keys(nav) as Screen[]).map((item) => (
              <button
                key={item}
                aria-label={item === "Finances" ? "Wallet" : item}
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
        {screen !== "City" && (
          <main className="main-content board-ledger" id="main-content">
            <div className="ledger-head">
              <div>
                <p className="eyebrow">
                  STIXX CITY /{" "}
                  {screen === "Finances" ? "WALLET" : screen.toUpperCase()}
                </p>
                <h2>
                  {screen === "People"
                    ? "People remember."
                    : screen === "Actions"
                      ? "Make your next move."
                      : screen === "Set"
                        ? "Your people. Your Set."
                        : screen === "Journal"
                          ? "The city remembers."
                          : "Keep yourself afloat."}
                </h2>
              </div>
              <button
                className="advance"
                onClick={endDay}
                disabled={!!s.end}
                aria-label="End day"
              >
                <span className="advance-label">End day</span>{" "}
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="ledger-close"
                aria-label="Back to the city"
                onClick={() => setScreen("City")}
              >
                ✕
              </button>
            </div>
            {toast}
            {alerts}
            {screen === "Journal" && (
              <>
                {activeStory && (
                  <section className="storylines" aria-label="Storylines">
                    <h3>Storylines</h3>
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
                  </section>
                )}
                <CommitmentSummary s={s} />
                <>
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
                  {p.connections.includes(person.id) && (
                    <p className="muted">{knownCapabilities(person)}</p>
                  )}
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
                        : `${accessStatus(s, p.id, person.id)}${contactError(s, p.id, person.id) ? " · " + contactError(s, p.id, person.id) : " · Available to contact"}`
                      : "Currently " + person.status + "."}
                  </p>
                  {p.connections.includes(person.id) && (
                    <>
                      <Meter
                        label="Their trust in you"
                        value={person.relationships[p.id]?.trust ?? 0}
                        description={band(
                          person.relationships[p.id]?.trust ?? 0,
                          ["Wary", "Acquainted", "Trusting", "Close"],
                        )}
                      />
                      <Meter
                        label="Your trust in them"
                        value={p.relationships[person.id]?.trust ?? 0}
                        description={band(
                          p.relationships[person.id]?.trust ?? 0,
                          ["Wary", "Acquainted", "Trusting", "Close"],
                        )}
                      />
                      <p className="muted">
                        Work {person.skills.work} · Social{" "}
                        {person.skills.social} · Recovery{" "}
                        {person.skills.recovery}
                      </p>
                    </>
                  )}
                  <button
                    className="primary"
                    disabled={!!contactError(s, p.id, person.id)}
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
                    <h3>A personal crew.</h3>
                    <span className="status-chip">
                      {s.crew.members.length}/{s.crew.capacity} MEMBERS
                    </span>
                  </div>
                  <p>
                    Your Set is a circle of up to five trusted people, distinct
                    from the city’s five organizations. Influence expands
                    capacity at 5, 15, 30 and 50.
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
                        {s.characters[a.member].name} · {a.objective} ·{" "}
                        {a.status} · day {a.dueDay}
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
                      No plans yet. Talk with a member; they also bring ideas
                      when their own lives allow.
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
                        a: Action = {
                          type: "recruit",
                          actor: p.id,
                          target: id,
                        },
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
                              <small className="disabled-reason">
                                {reason}
                              </small>
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
                  <p>Living expenses are charged as you advance each day.</p>
                  <p className="muted">
                    Clean and illicit funds keep separate provenance. Purchases
                    use clean money first. Running short increases stress; it
                    never locks you out of work.
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
                      Your first $125 is clean starting cash. Future
                      transactions appear here.
                    </p>
                  )}
                </Panel>
              </>
            )}
            {screen === "Journal" && (
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
                  <summary>Completed storylines</summary>
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
                            Revisit{" "}
                            {(() => {
                              const id = s.encounters
                                .find((x) => x.sourceEventId === e.id)
                                ?.participants.find((id) => id !== p.id);
                              return id
                                ? (s.characters[id].alias ??
                                    s.characters[id].name)
                                : "this person";
                            })()}
                            ’s reaction
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
                acknowledged outcomes. Saves stay in this browser on this
                device.
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
        )}
      </div>
    </div>
  );
}
