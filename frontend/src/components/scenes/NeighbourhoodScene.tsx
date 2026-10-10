import { LeafLayer } from "./LeafLayer";
import { SparrowMascot, type SparrowPose } from "../SparrowMascot";

export type SceneState = "dawn" | "hazy" | "fresh" | "thriving";

/**
 * The neighbourhood scene (sky, hills, wire, rooftops, clothesline, solar panel).
 * SVG reused verbatim from the Figma Make export. The number of birds and the
 * sky treatment change with `state`.
 */
export function NeighbourhoodScene({
  state,
  pose = "curious",
  line,
  compact = false,
  className = "",
}: {
  state: SceneState;
  pose?: SparrowPose;
  line: string;
  compact?: boolean;
  className?: string;
}) {
  const birdCount = state === "dawn" ? 0 : state === "hazy" ? 1 : state === "fresh" ? 3 : 5;
  return (
    <div className={`neighbourhood ${state} ${compact ? "compact" : ""} ${className}`.trim()}>
      <div className="world-frame">
        {(state === "fresh" || state === "thriving") && <LeafLayer count={12} home />}
        <svg
          className="world"
          viewBox="0 0 800 480"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={`${state} Indian neighbourhood`}
        >
          <rect className="sky" width="800" height="480" />
          <circle className="scene-sun" cx="645" cy="95" r="62" />
          <path className="hills far" d="M0 250Q110 140 220 245T450 238T800 220V480H0Z" />
          <path className="hills near" d="M0 310Q160 205 300 306T590 288T800 275V480H0Z" />
          <path className="wire" d="M0 138Q350 188 800 128" />
          {Array.from({ length: birdCount }).map((_, i) => (
            <path key={i} className="wire-bird" d={`M${160 + i * 82} ${151 + (i % 2) * 5}q8-8 16 0q8-8 16 0`} />
          ))}
          <g className="roof roof-a"><path d="M-20 355 175 260l185 95Z" /><rect x="35" y="345" width="270" height="135" /><rect className="window" x="80" y="376" width="50" height="60" /><rect className="window" x="200" y="376" width="50" height="60" /></g>
          <g className="roof roof-b"><path d="m330 363 165-92 170 92Z" /><rect x="365" y="350" width="265" height="130" /><rect className="door" x="470" y="392" width="57" height="88" /></g>
          <g className="roof roof-c"><path d="m585 370 110-70 125 70Z" /><rect x="620" y="360" width="180" height="120" /></g>
          <g className="tank"><rect x="221" y="245" width="62" height="67" rx="7" /><path d="M216 255h72M216 270h72M216 287h72" /></g>
          <g className="tank tank-two"><rect x="665" y="286" width="49" height="54" rx="6" /><path d="M660 298h59M660 314h59" /></g>
          <g className="tree"><path className="trunk" d="M107 391q28-88 13-175M119 299l-43-44M119 272l53-58" /><circle cx="77" cy="242" r="48" /><circle cx="130" cy="209" r="58" /><circle cx="174" cy="247" r="48" /><circle cx="115" cy="265" r="59" /></g>
          {state === "thriving" && (
            <g className="blossoms">
              {[[72, 225], [118, 195], [158, 230], [96, 274], [146, 264]].map(([x, y]) => (
                <circle key={`${x}${y}`} cx={x} cy={y} r="8" />
              ))}
            </g>
          )}
          <g className="clothesline"><path d="M341 307q105 30 205 0" /><path className="cloth c1" d="m367 314 44 8-8 50-43-8Z" /><path className="cloth c2" d="m432 323 38 2-1 49-39-3Z" /><path className="cloth c3" d="m493 321 39-7 8 48-42 8Z" /></g>
          {state === "thriving" && <g className="solar-panel"><path d="m382 322 100-37 53 30-104 39Z" /><path d="m408 313 50 29M443 299l49 29M461 294l-2 47" /></g>}
        </svg>
        <div className="scene-persona">
          <div className="speech">{line}</div>
          <SparrowMascot pose={pose} size={compact ? 70 : 104} />
        </div>
      </div>
      <span className="scene-state">
        {state === "dawn"
          ? "Dawn · waiting for your first verified bill"
          : state === "hazy"
            ? "Hazy · based on your verified bills"
            : state === "fresh"
              ? "Fresh · based on your verified bills"
              : "Thriving · based on your verified bills"}
      </span>
    </div>
  );
}

