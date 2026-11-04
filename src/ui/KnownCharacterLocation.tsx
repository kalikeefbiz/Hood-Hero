import type { GameState } from "../core/GameState";
import { quannyAddress } from "../systems/QuannyState";
export function KnownCharacterLocation({
  s,
  id,
}: {
  s: GameState;
  id: string;
}) {
  if (id !== "quanny" || !s.quanny.knownLocation) return null;
  return (
    <p className="muted" aria-label="Known location for Quanny">
      Known location: {quannyAddress(s)}.
    </p>
  );
}
