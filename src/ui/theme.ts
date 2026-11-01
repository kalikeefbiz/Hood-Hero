import type { CSSProperties } from "react";
import type { FactionId } from "../core/GameState";

// Presentation only. Membership in saved game state is the sole HUD theme source.
export const THEMES = {
  independent: { accent: "#A8ADB3", secondary: "#D9D7D1" },
  angels: { accent: "#E9BE39", secondary: "#F5F1E6" },
  blips: { accent: "#8E51CB", secondary: "#B08AD8" },
  muds: { accent: "#CD7935", secondary: "#80513C" },
  backstreet: { accent: "#C83D45", secondary: "#EB7376" },
  blocks: { accent: "#3678C6", secondary: "#89B3E2" },
} as const;
export function themeStyle(affiliation: FactionId | null): CSSProperties {
  const theme = THEMES[affiliation ?? "independent"];
  return {
    "--accent": theme.accent,
    "--accent-secondary": theme.secondary,
    "--accent-text": affiliation === "muds" ? "#E2B28C" : theme.secondary,
  } as CSSProperties;
}
