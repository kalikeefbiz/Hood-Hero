import { createPortal } from "react-dom";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import type { GameState, ZoneId } from "../core/GameState";
import { CityMap } from "./CityMap";
import { THEMES, themeStyle } from "./theme";
import { ZONE_ORDER, type LandmarkTarget } from "../city3d/layout";
import { zoneDescription } from "../city3d/viewModel";
import { readPref, supportsWebGL, writePref } from "../city3d/support";
import type { TimeOfDay } from "../city3d/CityRenderer";

// three.js is loaded only when the 3D city is shown, so the rest of the game
// keeps its original bundle size and start-up time.
const City3D = lazy(() => import("./City3D"));

class Fallback extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Mode = "3d" | "2d";
const TIMES: { id: TimeOfDay; label: string }[] = [
  { id: "dusk", label: "Dusk" },
  { id: "night", label: "Night" },
  { id: "day", label: "Day" },
];

export function CityView({
  s,
  selected,
  onSelect,
  onOpen,
}: {
  s: GameState;
  selected: ZoneId;
  onSelect: (id: ZoneId) => void;
  onOpen: (target: LandmarkTarget, zone: ZoneId) => void;
}) {
  const chipsId = useId();
  const [webgl] = useState(supportsWebGL);
  const [mode, setMode] = useState<Mode>(() =>
    webgl ? readPref("hoodhero.cityView", ["3d", "2d"], "3d") : "2d",
  );
  const [time, setTime] = useState<TimeOfDay>(() =>
    readPref("hoodhero.cityTime", ["dusk", "night", "day"], "dusk"),
  );
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    if (!immersive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setImmersive(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [immersive]);
  const show3d = mode === "3d" && webgl;
  const choose = (m: Mode) => {
    setMode(m);
    writePref("hoodhero.cityView", m);
    if (m === "2d") setImmersive(false);
  };
  const content = (
    <div
      className={`city-view ${show3d ? "is-3d" : "is-2d"} ${immersive ? "immersive" : ""}`}
    >
      <div className="city-view-toolbar">
        {webgl && (
          <div
            className="segmented city-mode"
            role="group"
            aria-label="City view"
          >
            <button
              aria-pressed={show3d}
              aria-label="3D city"
              onClick={() => choose("3d")}
            >
              3D
            </button>
            <button aria-pressed={!show3d} onClick={() => choose("2d")}>
              Map
            </button>
          </div>
        )}
        {show3d && (
          <>
            <div
              className="segmented city-time"
              role="group"
              aria-label="Time of day"
            >
              {TIMES.map((t) => (
                <button
                  key={t.id}
                  aria-pressed={time === t.id}
                  onClick={() => {
                    setTime(t.id);
                    writePref("hoodhero.cityTime", t.id);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {show3d ? (
        <Fallback onError={() => choose("2d")}>
          <Suspense
            fallback={
              <div className="city3d-stage city-map city3d-loading">
                <span>Building Stixx City…</span>
              </div>
            }
          >
            <City3D
              s={s}
              selected={selected}
              onSelect={onSelect}
              time={time}
              immersive={immersive}
              toggleImmersive={() => setImmersive((v) => !v)}
              onOpen={(target, zone) => {
                setImmersive(false);
                onOpen(target, zone);
              }}
            />
          </Suspense>
        </Fallback>
      ) : (
        <CityMap s={s} selected={selected} onSelect={onSelect} />
      )}
      {show3d && (
        <div
          className="district-chips"
          role="group"
          aria-label="Five neighborhoods of Stixx City"
        >
          {ZONE_ORDER.map((id) => {
            const z = s.zones[id],
              t = s.strategic.territories[id];
            const colors = z.organizations.length
              ? z.organizations.map((f) => THEMES[f].accent)
              : ["#A8ADB3"];
            return (
              <button
                key={id}
                aria-label={`Select ${z.name}`}
                aria-pressed={selected === id}
                aria-describedby={`${chipsId}-${id}`}
                onClick={() => onSelect(id)}
              >
                <span className="chip-colors" aria-hidden="true">
                  {colors.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <span>{z.name}</span>
                {t.contested && (
                  <small className="chip-contested" aria-hidden="true">
                    !
                  </small>
                )}
                {s.characters[s.playerId].home === id && (
                  <small className="chip-home" aria-hidden="true">
                    ●
                  </small>
                )}
                <span id={`${chipsId}-${id}`} hidden>
                  {zoneDescription(s, id)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
  // Full screen escapes the page layout entirely so it fills the phone.
  return immersive ? (
    <>
      <div className="city-view-placeholder" />
      {createPortal(
        <div
          className="city-immersive-root"
          style={themeStyle(s.characters[s.playerId].affiliation)}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  ) : (
    content
  );
}
