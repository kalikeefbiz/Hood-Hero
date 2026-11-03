import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, ZoneId } from "../core/GameState";
import { CityRenderer, type TimeOfDay } from "../city3d/CityRenderer";
import {
  LANDMARKS,
  ZONE_ORDER,
  type LandmarkDefinition,
  type LandmarkTarget,
} from "../city3d/layout";
import { deriveCityView, type CityView } from "../city3d/viewModel";
import { band } from "../city3d/support";
import "./city3d.css";

const KIND_LABEL: Record<LandmarkDefinition["kind"], string> = {
  civic: "Civic",
  police: "Police",
  work: "Work",
  business: "Business",
  community: "Community",
  street: "Street",
  transit: "Transit",
  home: "Housing",
};
const KIND_ICON: Record<LandmarkDefinition["kind"], string> = {
  civic: "⌂",
  police: "◆",
  work: "$",
  business: "★",
  community: "♥",
  street: "◎",
  transit: "▤",
  home: "▲",
};

export default function City3D({
  s,
  selected,
  onSelect,
  time,
  immersive,
  toggleImmersive,
  onOpen,
}: {
  s: GameState;
  selected: ZoneId;
  onSelect: (id: ZoneId) => void;
  time: TimeOfDay;
  immersive: boolean;
  toggleImmersive: () => void;
  onOpen: (target: LandmarkTarget, zone: ZoneId) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const city = useRef<CityRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [landmark, setLandmark] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const view = useMemo(() => deriveCityView(s), [s]);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    const r = CityRenderer.acquire(host.current!);
    city.current = r;
    r.onInteract = () => setHint(false);
    r.onPick = ({ zone, landmark }) => {
      if (landmark) {
        setLandmark(landmark);
        r.setSelectedLandmark(landmark);
      } else setLandmark(null);
      if (zone) select.current(zone);
    };
    setReady(true);
    return () => {
      r.detach();
      city.current = null;
    };
  }, []);
  useEffect(() => {
    city.current?.setView(view);
  }, [view, ready]);
  const first = useRef(true);
  useEffect(() => {
    // Open on the whole city; later selections fly to the district.
    city.current?.setSelected(selected, !first.current);
    first.current = false;
    setLandmark((l) =>
      l && LANDMARKS.find((x) => x.id === l)?.zone !== selected ? null : l,
    );
  }, [selected, ready]);
  useEffect(() => {
    city.current?.setTimeOfDay(time);
  }, [time, ready]);
  useEffect(() => {
    if (!landmark) city.current?.setSelectedLandmark(null);
  }, [landmark]);

  const anchor =
    (
      key: string,
      kind: "zone" | "landmark",
      id: string,
      range: { maxDistance?: number; minDistance?: number },
    ) =>
    (el: HTMLElement | null) => {
      const r = city.current;
      if (!r) return;
      if (el)
        r.registerOverlay({
          key,
          element: el,
          position: CityRenderer.anchorFor(kind, id),
          ...range,
        });
      else r.unregisterOverlay(key);
    };
  const visibleLandmarks = LANDMARKS.filter(
    (l) =>
      l.zone === selected ||
      view.landmarks[l.id]?.owned ||
      view.landmarks[l.id]?.employed,
  );
  const active = LANDMARKS.find((l) => l.id === landmark);

  return (
    <div className="city3d-stage city-map" ref={host}>
      {ready &&
        ZONE_ORDER.map((id) => (
          <DistrictLabel
            key={id}
            zone={view.zones[id]}
            selected={selected === id}
            refCallback={anchor(`zone-${id}`, "zone", id, { minDistance: 135 })}
          />
        ))}
      {ready &&
        visibleLandmarks.map((l) => {
          const st = view.landmarks[l.id];
          return (
            <button
              key={l.id}
              ref={anchor(`lm-${l.id}`, "landmark", l.id, { maxDistance: 165 })}
              className={`city3d-pin kind-${l.kind} ${st?.owned ? "owned" : ""} ${landmark === l.id ? "active" : ""}`}
              aria-label={`Open ${l.name}`}
              onClick={() => {
                setLandmark(l.id);
                city.current?.setSelectedLandmark(l.id);
                if (l.zone !== selected) onSelect(l.zone);
              }}
            >
              <span aria-hidden="true">{KIND_ICON[l.kind]}</span>
              <em>{l.name}</em>
            </button>
          );
        })}
      <div className="city3d-hud">
        <button
          className="city3d-overview"
          onClick={() => {
            setLandmark(null);
            city.current?.overview();
          }}
        >
          Whole city
        </button>
        <button
          className="city-expand"
          aria-pressed={immersive}
          aria-label={immersive ? "Exit full screen city" : "Full screen city"}
          onClick={toggleImmersive}
        >
          {immersive ? "✕" : "⤢"}
        </button>
      </div>
      {hint && !landmark && (
        <p className="city3d-hint" aria-hidden="true">
          Drag to move · Pinch to zoom · Twist to turn · Tap a place
        </p>
      )}
      {active && (
        <LandmarkCard
          l={active}
          view={view}
          onClose={() => setLandmark(null)}
          onOpen={() => onOpen(active.target, active.zone)}
        />
      )}
    </div>
  );
}

function DistrictLabel({
  zone,
  selected,
  refCallback,
}: {
  zone: CityView["zones"][ZoneId];
  selected: boolean;
  refCallback: (el: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={refCallback}
      className={`city3d-label ${selected ? "selected" : ""}`}
      style={{ borderColor: zone.controllerColor }}
      aria-hidden="true"
    >
      <strong>{zone.name}</strong>
      <span>
        {zone.contested
          ? "CONTESTED"
          : zone.controller
            ? zone.presence[0]?.name.toUpperCase()
            : zone.presence.length > 1
              ? "SHARED"
              : "UNCLAIMED"}
        {zone.isHome ? " · HOME" : ""}
      </span>
    </div>
  );
}

function LandmarkCard({
  l,
  view,
  onClose,
  onOpen,
}: {
  l: LandmarkDefinition;
  view: CityView;
  onClose: () => void;
  onOpen: () => void;
}) {
  const z = view.zones[l.zone],
    st = view.landmarks[l.id];
  const lines: string[] = [];
  if (st?.status) lines.push(st.status);
  if (st?.employed) lines.push("You work here.");
  if (l.kind === "police")
    lines.push(
      `Police presence: ${band(z.police, ["Minimal", "Light", "Elevated", "Heavy"])} (${z.police})`,
    );
  if (l.kind === "street" || l.kind === "transit")
    lines.push(
      `Street activity: ${band(z.streetActivity, ["Quiet", "Steady", "Busy", "Crowded"])} · Police ${band(z.police, ["minimal", "light", "elevated", "heavy"])}`,
    );
  if (l.kind === "community" || l.kind === "home" || l.kind === "work")
    lines.push(
      `Your standing here: ${band(z.standing, ["Unknown", "Familiar face", "Trusted", "Influential"])}`,
    );
  if (l.kind === "civic")
    lines.push(
      z.controller
        ? `Recognized control: ${z.presence[0]?.name}`
        : "No organization runs these blocks.",
    );
  return (
    <section
      className="city3d-card"
      aria-label={l.name}
      style={{ borderTopColor: z.controllerColor }}
    >
      <p className="eyebrow">
        {z.name} · {KIND_LABEL[l.kind]}
      </p>
      <h4>{l.name}</h4>
      <p>{l.description}</p>
      {lines.map((line) => (
        <p className="city3d-card-status" key={line}>
          {line}
        </p>
      ))}
      <div className="city3d-card-actions">
        <button className="city3d-go" onClick={onOpen}>
          {l.targetLabel} →
        </button>
        <button
          className="city3d-close"
          onClick={onClose}
          aria-label="Close place"
        >
          Close
        </button>
      </div>
    </section>
  );
}
