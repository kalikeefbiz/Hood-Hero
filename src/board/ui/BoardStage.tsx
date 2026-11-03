import { useEffect, useRef, useState } from "react";
import type { ZoneId } from "../../core/GameState";
import {
  BoardRenderer,
  LEVEL_DISTANCE,
  type Focus,
  type Lens,
  type TimeOfDay,
} from "../BoardRenderer";
import { KIND_ICON, LOCATIONS } from "../locations";
import { ZONE_ORDER } from "../../city3d/layout";
import type { BoardView } from "../viewModel";

// The live 3D board. Loaded lazily so three.js never slows the menus down.
export default function BoardStage({
  view,
  focus,
  onPick,
  lens,
  time,
  insets,
  onInteract,
}: {
  view: BoardView;
  focus: Focus;
  onPick: (f: Focus) => void;
  lens: Lens;
  time: TimeOfDay;
  insets: { top: number; bottom: number };
  onInteract?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<BoardRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [distance, setDistance] = useState(LEVEL_DISTANCE.city);
  const pick = useRef(onPick);
  pick.current = onPick;
  const touch = useRef(onInteract);
  touch.current = onInteract;

  useEffect(() => {
    const r = BoardRenderer.acquire(host.current!);
    board.current = r;
    r.onPick = (f) => pick.current(f);
    r.onInteract = () => touch.current?.();
    r.onLevel = (d) => setDistance(Math.round(d / 10) * 10);
    setReady(true);
    setDistance(r.cameraDistance);
    return () => {
      r.detach();
      board.current = null;
    };
  }, []);
  useEffect(() => board.current?.setView(view), [view, ready]);
  useEffect(() => board.current?.setLens(lens), [lens, ready]);
  useEffect(() => board.current?.setTimeOfDay(time), [time, ready]);
  useEffect(
    () => board.current?.setInsets(insets.top, insets.bottom),
    [insets.top, insets.bottom, ready],
  );
  const first = useRef(true);
  useEffect(() => {
    // Opening the board keeps the camera where it was; later focus changes fly.
    board.current?.setFocus(focus, !first.current);
    first.current = false;
  }, [focus.zone, focus.block, focus.place, ready]);

  const anchor =
    (
      key: string,
      kind: "zone" | "place",
      id: string,
      range: { maxDistance?: number; minDistance?: number; clearance?: number },
    ) =>
    (el: HTMLElement | null) => {
      const r = board.current;
      if (!r) return;
      if (el)
        r.registerOverlay({
          key,
          element: el,
          position: BoardRenderer.anchorFor(kind, id),
          ...range,
        });
      else r.unregisterOverlay(key);
    };
  const pins = LOCATIONS.filter((l) => {
    const st = view.places[l.id];
    return (
      l.zone === focus.zone ||
      st?.owned ||
      st?.employed ||
      st?.home ||
      (lens === "opportunity" && st?.live)
    );
  });
  return (
    <div className="board-stage city-map" ref={host}>
      {ready &&
        ZONE_ORDER.map((id) => {
          const z = view.zones[id];
          return (
            <div
              key={id}
              ref={anchor(`zone-${id}`, "zone", id, { minDistance: 150, clearance: 34 })}
              className={`board-label ${focus.zone === id ? "selected" : ""}`}
              aria-hidden="true"
            >
              <strong>{z.name}</strong>
              <span>
                {z.contested
                  ? "CONTESTED"
                  : z.controller
                    ? z.presence[0]?.name.toUpperCase()
                    : z.presence.length > 1
                      ? `${z.presence
                          .map((p) => p.name.replace("The ", ""))
                          .join(" · ")
                          .toUpperCase()}`
                      : "UNCLAIMED"}
                {z.isHome ? " · HOME" : ""}
              </span>
            </div>
          );
        })}
      {ready &&
        pins.map((l) => {
          const st = view.places[l.id];
          return (
            <button
              key={l.id}
              ref={anchor(`place-${l.id}`, "place", l.id, { maxDistance: 165, clearance: 40 })}
              className={`board-pin kind-${l.kind} ${st?.live ? "live" : "planned"} ${st?.owned ? "owned" : ""} ${focus.place === l.id ? "active" : ""} ${distance < 60 ? "near" : ""}`}
              aria-label={`Open ${l.name}`}
              onClick={() => onPick({ zone: l.zone, block: null, place: l.id })}
            >
              <span aria-hidden="true">{KIND_ICON[l.kind]}</span>
              <em>{l.name}</em>
              {st?.actions ? <b aria-hidden="true">{st.actions}</b> : null}
            </button>
          );
        })}
    </div>
  );
}
export type { ZoneId };
