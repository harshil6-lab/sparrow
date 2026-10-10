/**
 * Sparrow mascot — SVG illustration reused verbatim from the Figma Make export.
 * Four poses are supported: curious, hop, ruffled, celebrate.
 * (`celebrate` maps to the source pose key "spin"; the resting `curious` pose
 * carries no modifier class, matching the design.)
 */
export type SparrowPose = "curious" | "hop" | "ruffled" | "celebrate";

const POSE_CLASS: Record<SparrowPose, string> = {
  curious: "pose-curious",
  hop: "pose-hop",
  ruffled: "pose-ruffled",
  celebrate: "pose-spin",
};

export function SparrowMascot({
  pose = "curious",
  size = 92,
  className = "",
}: {
  pose?: SparrowPose;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`sparrow ${POSE_CLASS[pose]} ${className}`.trim()}
      width={size}
      viewBox="0 0 130 105"
      role="img"
      aria-label="Sparrow"
    >
      <g className="sparrow-body">
        <path fill="#8C6649" d="M27 70c4-29 25-47 54-43 18 2 29 15 28 34-1 17-17 30-39 32-22 2-39-6-43-23Z" />
        <path fill="#D7C0A2" d="M40 69c14-6 28-3 42 11-12 14-34 17-48 6-7-6-4-13 6-17Z" />
        <path fill="#6C4A37" d="M55 38c14-10 36-9 48 2-18 3-29 13-34 30-12-8-17-18-14-32Z" />
        <path fill="#202A22" d="M91 38c10 4 15 11 16 20-8 2-15 0-21-6l5-14Z" />
        <path fill="#202A22" d="M77 55c12 0 20 6 23 17-11 3-21-1-29-10l6-7Z" />
        <circle cx="97" cy="43" r="3.2" fill="#fff" /><circle cx="98" cy="43" r="1.7" fill="#17261B" />
        <path fill="#C97945" d="m107 48 17 5-17 5V48Z" />
        <path fill="#202A22" d="M29 69 5 58l18 22 6-11Z" />
        <path fill="#5D3C2D" d="M47 48c13 1 24 8 32 23-18 5-32 0-42-14l10-9Z" />
        <path fill="none" stroke="#EDE1D0" strokeWidth="3" d="M45 54c9 2 17 6 24 12M42 60c8 2 14 6 19 10" />
        <path fill="#C84638" d="M73 71c10-2 19 0 27 5l-7 9c-8-5-16-7-24-5l4-9Z" />
        <path fill="#fff" d="m80 72 6 12 6-10-12-2ZM94 77l7 15 4-14-11-1Z" />
        <path stroke="#443328" strokeWidth="3" d="M58 90v10M81 90v10M52 101h12M76 101h12" />
      </g>
    </svg>
  );
}
