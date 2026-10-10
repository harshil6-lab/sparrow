import type { ReactElement } from "react";
import { EditorialArt, type ArtKind } from "./EditorialArt";
import { LeafLayer } from "./LeafLayer";
import { SparrowMascot, type SparrowPose } from "../SparrowMascot";

/**
 * Scene illustrations, one component per screen (S8).
 * Each screen gets its own art kind from the design; nothing is reused across
 * screens except the shared <EditorialArt> shell.
 */

/**
 * Splash: falling leaves + the sparrow gliding in to land on the wire.
 * `leafCount` lets the splash scale the number of leaves to the viewport width
 * (the LeafLayer itself is unchanged; mobile keeps the default of 36).
 */
export function SplashScene({ leafCount }: { leafCount?: number }) {
  return (
    <>
      <div className="sunrise-glow" />
      <LeafLayer count={leafCount} />
      <div className="splash-bird">
        <div className="splash-wire" />
        <SparrowMascot pose="hop" size={150} />
      </div>
    </>
  );
}

/** Welcome landing hero ("panorama"). */
export function WelcomeScene() {
  return <EditorialArt kind="panorama" pose="hop" line="Morning! Let’s notice one useful thing." />;
}

/** Login doorway. */
export function LoginScene() {
  return <EditorialArt kind="doorway" pose="curious" line="Your Nest will be here when you return." />;
}

/** Ready ("Your Nest is ready"). */
export function ReadyScene() {
  return <EditorialArt kind="ready" pose="hop" line="Everything’s ready for one small win." />;
}

/** The five story frames — one component each, named by frame. */
export function StoryFrame1({ line }: { line: string }) {
  return <EditorialArt kind="courtyard" pose="curious" line={line} />;
}
export function StoryFrame2({ line }: { line: string }) {
  return <EditorialArt kind="ac-haze" pose="ruffled" line={line} />;
}
export function StoryFrame3({ line }: { line: string }) {
  return <EditorialArt kind="empty-lights" pose="curious" line={line} />;
}
export function StoryFrame4({ line }: { line: string }) {
  return <EditorialArt kind="empty-wire" pose="ruffled" line={line} />;
}
export function StoryFrame5({ line }: { line: string }) {
  return <EditorialArt kind="family-off" pose="celebrate" line={line} />;
}

export const STORY_FRAMES: { kind: ArtKind; pose: SparrowPose; Frame: (p: { line: string }) => ReactElement }[] = [
  { kind: "courtyard", pose: "curious", Frame: StoryFrame1 },
  { kind: "ac-haze", pose: "ruffled", Frame: StoryFrame2 },
  { kind: "empty-lights", pose: "curious", Frame: StoryFrame3 },
  { kind: "empty-wire", pose: "ruffled", Frame: StoryFrame4 },
  { kind: "family-off", pose: "celebrate", Frame: StoryFrame5 },
];

export const STORY_FRAME_COUNT = STORY_FRAMES.length;

/** Renders the illustration for a story frame index. */
export function StoryFrame({ index, line }: { index: number; line: string }) {
  const frame = STORY_FRAMES[index] ?? STORY_FRAMES[0];
  return <frame.Frame line={line} />;
}

