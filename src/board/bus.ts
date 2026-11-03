// A tiny bridge between the game UI and the lazily-loaded 3D board, so the
// main bundle can ask the board to animate without importing three.js.
type Walker = (placeId: string) => Promise<void>;
let walker: Walker | null = null;
let dayPulse: (() => void) | null = null;

export function connectBoard(w: Walker, pulse: () => void) {
  walker = w;
  dayPulse = pulse;
  return () => {
    if (walker === w) walker = null;
    dayPulse = null;
  };
}
/** Walk the player's figure to a place. Resolves immediately without a board. */
export const walkTo = (placeId: string) =>
  walker ? walker(placeId) : Promise.resolve();
export const pulseDay = () => dayPulse?.();
