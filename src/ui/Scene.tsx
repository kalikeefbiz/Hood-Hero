import { useState } from "react";
import type { ZoneId } from "../core/GameState";
import { neighborhoodImage, NEIGHBORHOODS } from "./neighborhoods";
export function Scene({
  zone,
  eager = false,
}: {
  zone: ZoneId;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const art = NEIGHBORHOODS[zone];
  return failed ? (
    <span className="scene-fallback">
      Neighborhood illustration unavailable
    </span>
  ) : (
    <img
      className="scene"
      src={neighborhoodImage(zone)}
      alt={art.alt}
      width="1448"
      height="1086"
      style={{ objectPosition: art.position }}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
