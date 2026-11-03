import { copy } from "../content/copy";
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
        {s.zones[p.home].name}
        {copy("interface.gameHUD.text")}
        {p.status}
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
        <strong className="day">
          {copy("interface.gameHUD.day")}
          {s.day.toString().padStart(2, "0")}
        </strong>
        <div className="hud-wordmark">
          {copy("interface.gameHUD.hoodHERO")}
          <span>{copy("interface.gameHUD.stixxCITY")}</span>
        </div>
        <span className="ap">
          <Icon name="ap" />
          <span>
            <small>{copy("interface.gameHUD.ap")}</small>
            <b>
              {s.ap}
              {copy("interface.gameHUD.text2")}
              {BALANCE.dailyAP}
            </b>
          </span>
        </span>
        <div className="header-tools">
          <button
            onClick={save}
            aria-label={copy("interface.gameHUD.saveGame")}
          >
            <Icon name="save" />
            <span>{copy("interface.gameHUD.save")}</span>
          </button>
          <button
            onClick={load}
            aria-label={copy("interface.gameHUD.loadGame")}
          >
            <Icon name="load" />
            <span>{copy("interface.gameHUD.load")}</span>
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
            {copy("interface.gameHUD.stixx0")}
            {Object.keys(NEIGHBORHOODS).indexOf(selected) + 1}
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
              {selected === p.home ? "YOUR HOME" : "NEIGHBORHOOD VIEW"}
              {copy("interface.gameHUD.text3")} {s.zones[selected].name}
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
      <div
        className="resource-strip"
        aria-label={copy("interface.gameHUD.playerResources")}
      >
        <Stat
          label={copy("interface.gameHUD.cash")}
          value={money(cash(p))}
          icon="cash"
          className="cash-resource"
        />
        <Stat
          label={copy("interface.gameHUD.influence")}
          value={Math.floor(p.influence)}
          icon="People"
        />
        <Stat
          label={copy("interface.gameHUD.stress")}
          value={Math.round(p.stress)}
          icon="pulse"
        />
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
