import type { SVGProps } from "react";
import type { ReactionType } from "../../../lib/api/data";

/** The five community reactions, in rail/popover order. */
export const REACTION_ORDER: ReactionType[] = ["grow", "sun", "cheer", "love", "idea"];

const STEM = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const };

/**
 * Flat sticker reaction icons drawn from scratch (no system emoji).
 * Each is a distinct silhouette filled with `currentColor` so the CSS layer
 * can tint it per reaction without losing contrast.
 */
export function ReactionIcon({ type, size = 26, ...rest }: { type: ReactionType; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...rest}>
      {type === "grow" ? (
        <>
          <path d="M12 13c0-3.2 2.1-5.4 5.4-5.4 0 3.2-2.1 5.4-5.4 5.4Z" fill="currentColor" />
          <path d="M12 13c0-3.2-2.1-5.4-5.4-5.4 0 3.2 2.1 5.4 5.4 5.4Z" fill="currentColor" />
          <path d="M12 13v8" {...STEM} />
        </>
      ) : null}
      {type === "sun" ? (
        <>
          <circle cx="12" cy="12" r="4.6" fill="currentColor" />
          <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" {...STEM} />
        </>
      ) : null}
      {type === "cheer" ? (
        <>
          <circle cx="12" cy="8" r="3.1" fill="currentColor" />
          <path d="M6.6 21.4v-4.6a5.4 5.4 0 0 1 10.8 0v4.6" {...STEM} />
          <path d="M6 10.6 3 6.8M18 10.6l3-3.8" {...STEM} />
          <path d="M2.6 4.4 5.9 5.6M21.4 4.4l-3.3 1.2" {...STEM} />
        </>
      ) : null}
      {type === "love" ? (
        <path d="M12 21C7.2 17.2 3 14 3 9.7A4.7 4.7 0 0 1 12 7a4.7 4.7 0 0 1 9 2.7c0 4.3-4.2 7.5-9 11.3Z" fill="currentColor" />
      ) : null}
      {type === "idea" ? (
        <>
          <path d="M8.6 14.8a5.6 5.6 0 1 1 6.8 0c-.8.6-1 1.4-1 2.6h-4.8c0-1.2-.2-2-1-2.6Z" fill="currentColor" />
          <path d="M9.6 19.4h4.8M10.4 21.6h3.2" {...STEM} />
        </>
      ) : null}
    </svg>
  );
}