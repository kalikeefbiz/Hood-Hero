import { useEffect, useRef, useState } from "react";
import type { ActionType } from "../core/ActionEngine";
import { ACTION_ART, actionArtUrl } from "./actionArt";
import { Icon } from "./Icon";

export function ActionIllustration({
  type,
  compact = false,
}: {
  type: ActionType;
  compact?: boolean;
}) {
  const art = ACTION_ART[type];
  const frame = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!frame.current || !art) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    // Unlike browser lazy-loading distance heuristics, this doesn't fetch cards
    // several screens below the player. Reserve the same frame before loading.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [art]);
  if (!art) return null;
  return (
    <div className="action-artwork" ref={frame}>
      {failed ? (
        <span
          className="action-art-fallback"
          role="img"
          aria-label={`${art.alt}. Illustration unavailable.`}
        >
          <Icon name="Actions" />
          <span>Illustration unavailable</span>
        </span>
      ) : visible ? (
        <img
          className="action-scene"
          src={actionArtUrl(art.file, 480)}
          srcSet={`${actionArtUrl(art.file, 480)} 480w, ${actionArtUrl(art.file, 960)} 960w`}
          sizes={
            compact
              ? "(max-width: 760px) 43vw, (max-width: 1280px) 30vw, 340px"
              : "(max-width: 760px) 100vw, 480px"
          }
          alt={art.alt}
          width={960}
          height={720}
          style={{
            objectPosition: compact ? art.compactPosition : art.position,
          }}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="action-art-placeholder" aria-hidden="true" />
      )}
    </div>
  );
}
