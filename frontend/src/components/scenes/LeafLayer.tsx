import { useMemo } from "react";

interface LeafSpec {
  left: number;
  delay: number;
  duration: number;
  size: number;
  tone: number;
  shape: number;
  blur: number;
}

/**
 * Falling-leaves layer. 30-40 leaves, 3 shapes, depth via size/speed/blur.
 * Animates with transform + opacity only (see `leaf-fall` in the stylesheet).
 * The reduced-motion media query in the stylesheet makes this static.
 */
export function LeafLayer({ count = 36, home = false }: { count?: number; home?: boolean }) {
  const leaves = useMemo<LeafSpec[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 29 + 7) % 100,
        delay: -((i * 0.73) % 9),
        duration: 7 + (i % 6) * 1.4,
        size: (home ? 10 : 13) + (i % 5) * (home ? 2 : 5),
        tone: i % 5,
        shape: i % 3,
        blur: i % 7 === 0 ? 1.6 : 0,
      })),
    [count, home],
  );
  return (
    <div className={`leaf-layer ${home ? "home-leaves" : ""}`.trim()} aria-hidden="true">
      {leaves.map((leaf, i) => (
        <i
          key={i}
          className={`leaf tone-${leaf.tone} shape-${leaf.shape}`}
          style={{
            left: `${leaf.left}%`,
            animationDelay: `${leaf.delay}s`,
            animationDuration: `${leaf.duration}s`,
            width: leaf.size,
            height: leaf.size * 1.65,
            filter: `blur(${leaf.blur}px)`,
          }}
        />
      ))}
    </div>
  );
}
