import { useEffect, useRef, useState } from "react";
import {
  BoardRenderer,
  LEVEL_DISTANCE,
  type Focus,
  type Lens,
  type TimeOfDay,
} from "../BoardRenderer";
import { KIND_ICON, LOCATIONS, locationById } from "../locations";
import { ZONE_ORDER } from "../../city3d/layout";
import type { BoardView } from "../viewModel";
import type { BoardPerson } from "../people";
import type { Appearance } from "../presence";
import { connectBoard } from "../bus";

export interface Popup {
  id: number;
  placeId: string;
  text: string;
  tone: "good" | "bad" | "neutral";
}

// The live 3D board. Loaded lazily so three.js never slows the menus down.
export default function BoardStage({
  view,
  focus,
  onPick,
  lens,
  time,
  insets,
  people,
  personId,
  onPerson,
  playerAt,
  appearance,
  accent,
  story,
  onStory,
  popups,
  onInteract,
}: {
  view: BoardView;
  focus: Focus;
  onPick: (f: Focus) => void;
  lens: Lens;
  time: TimeOfDay;
  insets: { top: number; bottom: number };
  people: BoardPerson[];
  personId: string | null;
  onPerson: (id: string) => void;
  playerAt: string;
  appearance: Appearance;
  accent: string;
  story: { placeId: string; title: string } | null;
  onStory: () => void;
  popups: Popup[];
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
    const disconnect = connectBoard(
      (id) => r.walkTo(id),
      () => r.passDay(),
    );
    setReady(true);
    setDistance(r.cameraDistance);
    return () => {
      disconnect();
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
  useEffect(
    () => board.current?.setAppearance(appearance),
    [appearance, ready],
  );
  useEffect(() => board.current?.setTokenColor(accent), [accent, ready]);
  // The piece is placed once; afterwards it only moves by walking.
  const placed = useRef(false);
  useEffect(() => {
    if (!board.current || placed.current) return;
    board.current.placeToken(playerAt);
    placed.current = true;
  }, [playerAt, ready]);
  useEffect(
    () =>
      board.current?.setFigures(
        people.map((p) => ({
          id: p.id,
          placeId: p.placeId,
          slot: p.slot,
          color: p.color,
        })),
      ),
    [people, ready],
  );
  const first = useRef(true);
  useEffect(() => {
    // The first focus flies in from the city overview.
    board.current?.setFocus(focus, true);
    first.current = false;
  }, [focus.zone, focus.block, focus.place, ready]);

  type Range = {
    maxDistance?: number;
    minDistance?: number;
    clearance?: number;
  };
  const anchor =
    (key: string, at: () => import("three").Vector3, range: Range) =>
    (el: HTMLElement | null) => {
      const r = board.current;
      if (!r) return;
      if (el) r.registerOverlay({ key, element: el, position: at(), ...range });
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
  const near = distance < 70;
  const nearPeople = people.filter(
    (p) => locationById(p.placeId)?.zone === focus.zone,
  );
  return (
    <div className="board-stage city-map" ref={host}>
      {ready &&
        ZONE_ORDER.map((id) => {
          const z = view.zones[id];
          return (
            <div
              key={id}
              ref={anchor(
                `zone-${id}`,
                () => BoardRenderer.anchorFor("zone", id),
                { minDistance: 150, clearance: 34 },
              )}
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
                      ? z.presence
                          .map((p) => p.name.replace("The ", ""))
                          .join(" · ")
                          .toUpperCase()
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
              ref={anchor(
                `place-${l.id}`,
                () => BoardRenderer.anchorFor("place", l.id),
                { maxDistance: 165, clearance: 40 },
              )}
              className={`board-pin kind-${l.kind} ${st?.live ? "live" : "planned"} ${st?.owned ? "owned" : ""} ${focus.place === l.id ? "active" : ""} ${near ? "near" : ""}`}
              aria-label={`Open ${l.name}`}
              onClick={() => onPick({ zone: l.zone, block: null, place: l.id })}
            >
              <span aria-hidden="true">{KIND_ICON[l.kind]}</span>
              <em>{l.name}</em>
              {st?.actions ? <b aria-hidden="true">{st.actions}</b> : null}
            </button>
          );
        })}
      {ready &&
        nearPeople.map((person) => (
          <button
            key={person.id}
            ref={anchor(
              `person-${person.id}`,
              () => board.current!.personSpot(person.placeId, person.slot),
              { maxDistance: 110, clearance: 30 },
            )}
            className={`board-person ${person.known ? "known" : "stranger"} ${personId === person.id ? "active" : ""} ${near ? "near" : ""}`}
            style={{ borderColor: person.color }}
            aria-label={`Talk to ${person.name}`}
            onClick={() => onPerson(person.id)}
          >
            <span aria-hidden="true">
              {person.known ? person.name.slice(0, 1) : "?"}
            </span>
            <em>{person.known ? person.name : "Stranger"}</em>
          </button>
        ))}
      {ready && story && (
        <button
          ref={anchor(
            "story",
            () =>
              BoardRenderer.anchorFor("place", story.placeId).setY(
                BoardRenderer.anchorFor("place", story.placeId).y + 4,
              ),
            { clearance: 40 },
          )}
          className="board-story"
          aria-label={`${story.title}: story at ${locationById(story.placeId)?.name}`}
          onClick={onStory}
        >
          <span aria-hidden="true">!</span>
        </button>
      )}
      {ready &&
        popups.map((p) => (
          <div
            key={p.id}
            ref={anchor(
              `popup-${p.id}`,
              () => BoardRenderer.anchorFor("place", p.placeId),
              {},
            )}
            className={`board-popup tone-${p.tone}`}
            aria-hidden="true"
          >
            <span>{p.text}</span>
          </div>
        ))}
    </div>
  );
}
