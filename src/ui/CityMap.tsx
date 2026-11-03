import { useId } from "react";
import type { GameState, ZoneId } from "../core/GameState";
import { THEMES } from "./theme";
const locations: Record<
  ZoneId,
  { x: number; y: number; w: number; h: number }
> = {
  nawf: { x: 120, y: 12, w: 170, h: 88 },
  reservoir: { x: 12, y: 122, w: 135, h: 130 },
  downtown: { x: 160, y: 122, w: 100, h: 130 },
  rio: { x: 273, y: 122, w: 135, h: 130 },
  south: { x: 120, y: 274, w: 170, h: 100 },
};
export function CityMap({
  s,
  selected,
  onSelect,
}: {
  s: GameState;
  selected: ZoneId;
  onSelect: (id: ZoneId) => void;
}) {
  const mapId = useId();
  return (
    <svg
      className="city-map"
      viewBox="0 0 420 390"
      role="group"
      aria-label="Five neighborhoods of Stixx City"
    >
      <defs>
        <pattern
          id={`${mapId}-blocks`}
          width="23"
          height="23"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M2 2h17v17H2z"
            fill="none"
            stroke="#afbaad"
            strokeWidth=".5"
            opacity=".1"
          />
        </pattern>
        {Object.values(s.zones).map((z) => {
          // Multiple organizations without a controller are shared presence,
          // never an inferred winner or a change to saved ownership.
          const factions = z.organizations;
          return (
            <linearGradient id={`${mapId}-${z.id}`} key={z.id}>
              {factions.flatMap((f, index) => [
                <stop
                  key={`${f}-start`}
                  offset={`${(index / factions.length) * 100}%`}
                  stopColor={THEMES[f].accent}
                />,
                <stop
                  key={`${f}-end`}
                  offset={`${((index + 1) / factions.length) * 100}%`}
                  stopColor={THEMES[f].accent}
                />,
              ])}
            </linearGradient>
          );
        })}
      </defs>
      <rect width="420" height="390" fill={`url(#${mapId}-blocks)`} />
      <path
        d="M0 110H420M0 264H420M153 0V390M267 0V390"
        stroke="#657369"
        strokeWidth="3"
        opacity=".25"
      />
      <path
        d="M5 320C85 290 25 180 90 130S290 170 330 70S400 50 419 0"
        stroke="#6b8981"
        strokeWidth="12"
        fill="none"
        opacity=".15"
      />
      {Object.entries(s.zones).map(([key, z]) => {
        const id = key as ZoneId,
          l = locations[id],
          color = z.controller ? THEMES[z.controller].accent : "#A8ADB3";
        const presence = z.organizations
          .map((f) => s.factions[f].name)
          .join(" / ");
        return (
          <g
            key={id}
            role="button"
            tabIndex={0}
            aria-label={`Select ${z.name}`}
            aria-pressed={selected === id}
            aria-describedby={`${mapId}-${id}-description`}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(id);
              }
            }}
          >
            <desc id={`${mapId}-${id}-description`}>
              {z.controller
                ? `Controlled by ${s.factions[z.controller].name}.`
                : "No single controller."}
              {presence ? ` Faction presence: ${presence}.` : " Unclaimed."}
            </desc>
            <rect
              className={`zone-base ${s.strategic.territories[id].contested ? "zone-contested" : ""}`}
              x={l.x}
              y={l.y}
              width={l.w}
              height={l.h}
              rx="5"
              fill={selected === id ? "#30343b" : "#191C20"}
              stroke={selected === id ? "var(--accent-secondary)" : color}
              strokeWidth={selected === id ? 2 : 0.7}
            />
            <rect
              className="zone-presence"
              x={l.x + 2}
              y={l.y + 2}
              width={l.w - 4}
              height={l.h - 4}
              rx="4"
              fill={
                z.controller || z.organizations.length
                  ? `url(#${mapId}-${id})`
                  : "#A8ADB3"
              }
              opacity={
                z.organizations.length
                  ? 0.1 +
                    Math.max(
                      ...Object.values(
                        s.strategic.territories[id].factions,
                      ).map((q) => q.influence),
                    ) /
                      400
                  : 0.06
              }
            />
            {/* A bright, narrow strip keeps each presence color legible. */}
            {(z.organizations.length
              ? z.organizations
              : z.controller
                ? [z.controller]
                : []
            ).map((f, index, factions) => (
              <rect
                key={f}
                x={l.x + 6 + (index * (l.w - 12)) / factions.length}
                y={l.y + l.h - 9}
                width={
                  (((l.w - 12) / factions.length) *
                    s.strategic.territories[id].factions[f].presence) /
                  100
                }
                height="3"
                fill={THEMES[f].accent}
              />
            ))}
            <text
              x={l.x + l.w / 2}
              y={l.y + l.h / 2 - 3}
              textAnchor="middle"
              fill="#e8eadf"
              fontSize={id === "downtown" ? 16 : 19}
              fontWeight="600"
            >
              {z.name}
            </text>
            <text
              x={l.x + l.w / 2}
              y={l.y + l.h / 2 + 16}
              textAnchor="middle"
              fill="#D9D7D1"
              fontSize="11"
              letterSpacing=".2"
            >
              {z.controller
                ? s.factions[z.controller].name.toUpperCase()
                : z.organizations.length
                  ? z.organizations
                      .map((f) =>
                        f === "muds" ? "Mudgang" : s.factions[f].name,
                      )
                      .join("/")
                  : "UNCLAIMED"}
            </text>
            {s.strategic.territories[id].contested && (
              <text
                x={l.x + l.w / 2}
                y={l.y + 18}
                textAnchor="middle"
                fill="#e2d5b2"
                fontSize="9"
                letterSpacing="1"
              >
                CONTESTED
              </text>
            )}
            {s.characters.player.home === id && (
              <circle
                cx={l.x + 12}
                cy={l.y + 12}
                r="3"
                fill="var(--accent-secondary)"
              />
            )}
          </g>
        );
      })}
      <text x="16" y="367" fill="#94a699" fontSize="9" letterSpacing="2">
        THE STIXX
      </text>
      <text x="390" y="32" fill="#94a699" fontSize="10">
        N ↑
      </text>
    </svg>
  );
}
