import type { GameState, ZoneId } from "../core/GameState";
import { THEMES } from "./theme";
const locations: Record<
  ZoneId,
  { x: number; y: number; w: number; h: number }
> = {
  nawf: { x: 120, y: 12, w: 170, h: 88 },
  resevoir: { x: 12, y: 122, w: 135, h: 130 },
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
  return (
    <svg
      className="city-map"
      viewBox="0 0 420 390"
      role="group"
      aria-label="Five neighborhoods of Stixx City"
    >
      <defs>
        <pattern
          id="blocks"
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
      </defs>
      <rect width="420" height="390" fill="url(#blocks)" />
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
        return (
          <g
            key={id}
            role="button"
            tabIndex={0}
            aria-label={`Select ${z.name}`}
            aria-pressed={selected === id}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(id);
              }
            }}
          >
            <rect
              x={l.x}
              y={l.y}
              width={l.w}
              height={l.h}
              rx="5"
              fill={selected === id ? "#30343b" : "#191C20"}
              stroke={selected === id ? "var(--accent-secondary)" : color}
              strokeWidth={selected === id ? 2 : 0.7}
            />
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
              fill={color}
              fontSize="11"
              letterSpacing=".2"
            >
              {z.controller
                ? s.factions[z.controller].name.toUpperCase()
                : z.organizations.length
                  ? "SHARED / " + z.organizations.length + " GROUPS"
                  : "UNCLAIMED"}
            </text>
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
