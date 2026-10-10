/**
 * Mission catalogue. Structure only — titles, copy and hints are i18n keys
 * (`missions.<id>.*`), reused from the Figma export's Missions tab.
 *
 * The recommended mission is the standby sweep, which reuses the existing
 * sweep flow. Completing any mission records an action and never moves the
 * world state (that comes only from verified bills).
 */
import type { IconName } from "../components/Icon";

export const RECOMMENDED_MISSION_ID = "standby_sweep";

export interface Mission {
  /** Stable id, also the i18n key prefix and the value persisted on completion. */
  id: string;
  icon: IconName;
}

/** The mission list from the design: cooling, daylight, hot water. */
export const MISSIONS: Mission[] = [
  { id: "ac", icon: "ac" },
  { id: "daylight", icon: "bulb" },
  { id: "geyser", icon: "geyser" },
];

export const MISSION_IDS: string[] = [RECOMMENDED_MISSION_ID, ...MISSIONS.map((m) => m.id)];

export function isMissionDone(doneIds: readonly string[], id: string): boolean {
  return doneIds.includes(id);
}
