import { heatDescription } from "../systems/CriminalExposure";
import { type GameState, type ZoneId, player, cash } from "../core/GameState";
import { BALANCE } from "../content/balance";
import { Scene } from "./Scene";
import { Icon, type IconName } from "./Icon";
import { money } from "./ActionCard";
import { NEIGHBORHOODS } from "./neighborhoods";

function Stat({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string | number;
  icon: IconName;
  className?: string;
}) {
  return (
    <span className={`hud-stat ${className}`}>
      <Icon name={icon} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </span>
  );
}
export function GameHUD({
  s,
  selected,
  cinematic,
  save,
  load,
}: {
  s: GameState;
  selected: ZoneId;
  cinematic: boolean;
  save: () => void;
  load: () => void;
}) {
  const p = player(s);
  const identity = (
    <div className="scene-identity">
      <h1>{p.name}</h1>
      <span className="home-label">
        {s.zones[p.home].name} · {p.status}
      </span>
    </div>
  );
  const affiliation = (
    <strong className="affiliation">
      {p.affiliation ? s.factions[p.affiliation].name : "Independent"}
    </strong>
  );
  return (
    <div
      className={`hud-composition ${cinematic ? "cinematic-hud" : "compact-hud"}`}
    >
      <header className="game-header">
        <strong className="day">DAY {s.day.toString().padStart(2, "0")}</strong>
        <div className="hud-wordmark">
          HOOD HERO<span>STIXX CITY</span>
        </div>
        <span className="ap">
          <Icon name="ap" />
          <span>
            <small>AP</small>
            <b>
              {s.ap}/{BALANCE.dailyAP}
            </b>
          </span>
        </span>
        <div className="header-tools">
          <button onClick={save} aria-label="Save game">
            <Icon name="save" />
            <span>Save</span>
          </button>
          <button onClick={load} aria-label="Load game">
            <Icon name="load" />
            <span>Load</span>
          </button>
        </div>
      </header>
      {cinematic ? (
        <section
          className="zone-hero"
          aria-label={`View of ${s.zones[selected].name}`}
        >
          <Scene key={selected} zone={selected} eager />
          <div className="scene-rules" aria-hidden="true" />
          {identity}
          <span className="hero-index">
            STIXX / 0{Object.keys(NEIGHBORHOODS).indexOf(selected) + 1}
          </span>
          <div className="hero-copy">
            <p className="scene-affiliation">
              <span>{p.affiliation ? "AFFILIATED" : "UNAFFILIATED"}</span>
              {affiliation}
            </p>
            <h2 className="hero-title">
              {p.affiliation
                ? s.factions[p.affiliation].name
                : s.zones[selected].name}
            </h2>
            <p className="hero-location">
              {selected === p.home ? "YOUR HOME" : "NEIGHBORHOOD VIEW"} /{" "}
              {s.zones[selected].name}
            </p>
            <p className="hero-flavor">{NEIGHBORHOODS[selected].flavor}</p>
          </div>
        </section>
      ) : (
        <div className="compact-identity">
          {identity}
          {affiliation}
        </div>
      )}
      <div className="resource-strip" aria-label="Player resources">
        <Stat
          label="Cash"
          value={money(cash(p))}
          icon="cash"
          className="cash-resource"
        />
        <Stat label="Influence" value={Math.floor(p.influence)} icon="People" />
        <Stat label="Stress" value={Math.round(p.stress)} icon="pulse" />
        <Stat
          label={`Heat · ${heatDescription(p.police)}`}
          value={Math.round(p.police)}
          icon="heat"
          className="heat-resource"
        />
      </div>
    </div>
  );
}
