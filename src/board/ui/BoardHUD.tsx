import { heatDescription } from "../../systems/CriminalExposure";
import { cash, player, type GameState } from "../../core/GameState";
import { BALANCE } from "../../content/balance";
import { Icon } from "../../ui/Icon";
import { money } from "../../ui/ActionCard";

/** One slim bar: the city needs the screen more than the stats do. */
export function BoardHUD({
  s,
  save,
  load,
  onLook,
}: {
  s: GameState;
  save: () => void;
  load: () => void;
  onLook: () => void;
}) {
  const p = player(s);
  return (
    <header className="board-hud" aria-label="Player status">
      <strong className="day">DAY {s.day.toString().padStart(2, "0")}</strong>
      <button
        className="board-hud-who"
        onClick={onLook}
        aria-label={`${p.name}: your character`}
      >
        <b>{p.name}</b>
        <strong className="affiliation">
          {p.affiliation ? s.factions[p.affiliation].name : "Independent"}
        </strong>
      </button>
      <span
        className="ap"
        aria-label={`Action points ${s.ap} of ${BALANCE.dailyAP}`}
      >
        <small>AP</small>
        <b>
          {s.ap}/{BALANCE.dailyAP}
        </b>
      </span>
      <span
        className="board-stat cash-resource"
        aria-label={`Cash ${money(cash(p))}`}
      >
        <small>Cash</small>
        <strong>{money(cash(p))}</strong>
      </span>
      <span
        className="board-stat stress-resource"
        aria-label={`Stress ${Math.round(p.stress)}`}
      >
        <small>Stress</small>
        <strong>{Math.round(p.stress)}</strong>
      </span>
      <span
        className="board-stat heat-resource"
        aria-label={`Heat ${heatDescription(p.police)}`}
      >
        <small>Heat</small>
        <strong>{Math.round(p.police)}</strong>
      </span>
      <button className="board-hud-btn" onClick={save} aria-label="Save game">
        <Icon name="save" />
      </button>
      <button className="board-hud-btn" onClick={load} aria-label="Load game">
        <Icon name="load" />
      </button>
    </header>
  );
}
