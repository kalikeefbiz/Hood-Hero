import { useState } from "react";
import type { GameState } from "../core/GameState";
import { artURL, characterArt, type Expression } from "./characterArt";
export function CharacterPortrait({
  s,
  id,
  expression = id === "quanny" ? "neutral" : "confident",
  className = "",
}: {
  s: GameState;
  id: string;
  expression?: Expression;
  className?: string;
}) {
  const art = characterArt(s, id, expression);
  return (
    <PortraitImage
      key={art?.path ?? id}
      s={s}
      id={id}
      expression={expression}
      className={className}
    />
  );
}
function PortraitImage({
  s,
  id,
  expression,
  className,
}: {
  s: GameState;
  id: string;
  expression: Expression;
  className: string;
}) {
  const [failed, setFailed] = useState(false),
    c = s.characters[id],
    art = characterArt(s, id, expression);
  return (
    <div
      className={`character-portrait ${className}`}
      style={
        id === "quanny" && art
          ? { aspectRatio: `${art.width} / ${art.height}` }
          : undefined
      }
    >
      {art && !failed ? (
        <img
          src={artURL(art.path)}
          alt={art.alt}
          width={art.width}
          height={art.height}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="character-placeholder"
          role="img"
          aria-label={`${c?.alias ?? c?.name ?? "Resident"} — no portrait available`}
        >
          <b>
            {(c?.name ?? "?")
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </b>
          <small>{c?.alias ?? c?.name}</small>
        </span>
      )}
    </div>
  );
}
