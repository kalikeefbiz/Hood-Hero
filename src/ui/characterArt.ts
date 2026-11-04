import type { GameState } from "../core/GameState";
export type Expression =
  "neutral" | "concerned" | "confident" | "proposing" | "strategizing";
interface Illustration {
  path: string;
  alt: string;
  width: number;
  height: number;
}
const mega = (name: string, alt: string, width: number): Illustration => ({
  path: `assets/characters/mega/${name}.webp`,
  alt,
  width,
  height: 1280,
});
const quanny = (
  name: string,
  alt: string,
  width: number,
  height = 581,
): Illustration => ({
  path: `assets/characters/quanny/quanny-${name}.webp`,
  alt,
  width,
  height,
});
// Explicit canonical mapping: manifest baby-canon is the simulation's stable babycanon ID.
export const CHARACTER_ART = {
  quanny: {
    neutral: quanny("neutral", "Quanny, neutral", 370),
    proposing: quanny("talking", "Quanny, talking and explaining", 374),
    concerned: quanny("disappointed", "Quanny, disappointed", 372),
    confident: quanny("pleased", "Quanny, confident and pleased", 374, 580),
    strategizing: quanny(
      "thinking",
      "Quanny, thinking and calculating",
      371,
      580,
    ),
  },
  mega: {
    concerned: mega(
      "mega-concerned-no-chain",
      "Cuzzo, concerned, without his chain",
      853,
    ),
    missing: mega(
      "mega-confident-no-chain",
      "Cuzzo, confident, without his chain",
      960,
    ),
    confident: mega(
      "mega-confident-with-chain",
      "Cuzzo, confident, wearing his returned chain",
      960,
    ),
    proposing: mega(
      "mega-proposing-with-chain",
      "Cuzzo proposing an idea, wearing his chain",
      1024,
    ),
    strategizing: mega(
      "mega-strategizing-with-chain",
      "Cuzzo strategizing, wearing his chain",
      1169,
    ),
  },
  babycanon: {
    path: "assets/characters/angels/baby-canon-portrait.webp",
    alt: "Baby Canon in a black hoodie and yellow face covering",
    width: 720,
    height: 1280,
  },
  joker: {
    path: "assets/characters/angels/joker-portrait.webp",
    alt: "Joker in a white tank top with yellow accessories",
    width: 720,
    height: 1280,
  },
  dizzy: {
    path: "assets/characters/angels/dizzy-portrait.webp",
    alt: "Dizzy in a yellow windbreaker",
    width: 720,
    height: 1280,
  },
} satisfies Record<string, Illustration | Record<string, Illustration>>;
export const CHAIN_EVIDENCE: Illustration = {
  path: "assets/incidents/the-chains/mega-stolen-chain-evidence.webp",
  alt: "Mega’s diamond pendant — item reference, not its current location",
  width: 1280,
  height: 961,
};
export const ANGELS_TRIO: Illustration = {
  path: "assets/characters/angels/gabriels-angels-trio.webp",
  alt: "Baby Canon, Joker, and Dizzy, from left to right",
  width: 1280,
  height: 853,
};
export const artURL = (path: string, base = import.meta.env.BASE_URL) =>
  `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
export function characterArt(
  s: GameState,
  id: string,
  expression: Expression = id === "quanny" ? "neutral" : "confident",
): Illustration | null {
  if (id === "quanny") return CHARACTER_ART.quanny[expression];
  if (id === "mega") {
    const pose = expression === "neutral" ? "confident" : expression;
    const possession = s.properties.chains?.possession;
    const hasChain =
      possession?.kind === "character" && possession.id === "mega";
    if (!hasChain)
      return pose === "concerned"
        ? CHARACTER_ART.mega.concerned
        : CHARACTER_ART.mega.missing;
    return CHARACTER_ART.mega[pose === "concerned" ? "confident" : pose];
  }
  if (id === "babycanon" || id === "joker" || id === "dizzy")
    return CHARACTER_ART[id];
  return null;
}
