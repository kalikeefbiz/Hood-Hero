import type { ActionType } from "../core/ActionEngine";

// Scene illustrations, not portraits of the player or named contacts.
// IDs, availability and outcomes continue to come from ActionEngine.
export const ACTION_ART: Partial<
  Record<
    ActionType,
    {
      file: string;
      alt: string;
      position: string;
      compactPosition: string;
    }
  >
> = {
  work: {
    file: "clock-in",
    alt: "A shop worker wheels boxes into a neighborhood grocery at sunset",
    position: "62% 42%",
    compactPosition: "78% 40%",
  },
  standing: {
    file: "build-local-connection",
    alt: "Three neighbors talk outside a warmly lit brick stoop",
    position: "62% 40%",
    compactPosition: "68% 40%",
  },
  rest: {
    file: "quiet-afternoon",
    alt: "Neighbors unwind by a parked car beneath the elevated train",
    position: "45% 43%",
    compactPosition: "40% 43%",
  },
  crime: {
    file: "black-market-opportunity",
    alt: "Two people make a street transaction outside a corner store",
    position: "65% 40%",
    compactPosition: "70% 40%",
  },
  inquire: {
    file: "ask-around",
    alt: "Two people exchange information on a brick building’s steps",
    position: "65% 26%",
    compactPosition: "68% 40%",
  },
};
export function actionArtUrl(file: string, width: 480 | 960) {
  return `${import.meta.env.BASE_URL}assets/actions/${file}-${width}.webp`;
}
