import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import type { GameState, ZoneId } from "../../core/GameState";
import { CityMap } from "../../ui/CityMap";
import type { Focus, Lens, TimeOfDay } from "../BoardRenderer";
import type { BoardView } from "../viewModel";
import "./board.css";

// three.js and the city load lazily, after the HUD and sheet are on screen.
const BoardStage = lazy(() => import("./BoardStage"));

export function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class Fallback extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The city behind everything: 3D board, or the 2D map without WebGL. */
export function BoardBackdrop(props: {
  s: GameState;
  view: BoardView;
  focus: Focus;
  onPick: (f: Focus) => void;
  lens: Lens;
  time: TimeOfDay;
  insets: { top: number; bottom: number };
  onInteract?: () => void;
}) {
  const [webgl] = useState(supportsWebGL);
  const flat = (
    <div className="board-flat">
      <CityMap
        s={props.s}
        selected={
          (props.focus.zone ??
            props.s.characters[props.s.playerId].home) as ZoneId
        }
        onSelect={(zone) => props.onPick({ zone, block: null, place: null })}
      />
    </div>
  );
  if (!webgl) return <div className="board-backdrop">{flat}</div>;
  return (
    <div className="board-backdrop">
      <Fallback fallback={flat}>
        <Suspense
          fallback={
            <div className="board-stage city-map board-loading">
              Building Stixx City…
            </div>
          }
        >
          <BoardStage
            view={props.view}
            focus={props.focus}
            onPick={props.onPick}
            lens={props.lens}
            time={props.time}
            insets={props.insets}
            onInteract={props.onInteract}
          />
        </Suspense>
      </Fallback>
    </div>
  );
}
