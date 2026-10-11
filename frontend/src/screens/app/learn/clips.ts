import type { IconName } from "../../../components/Icon";
import raw from "../../../data/learn-clips.json";

/**
 * The clip manifest. Poster, video and captions files are added later, so every
 * consumer must tolerate a missing file (illustrated poster + "Coming soon").
 */
export interface LearnClip {
  id: string;
  factId: string;
  title: string;
  category: string;
  src: string;
  poster: string;
  captions: string;
  captionsLang: string;
  durationSec: number;
}

export const LEARN_CLIPS: LearnClip[] = raw as LearnClip[];

/** "Hot water" -> "hotWater", so the label can come from an i18n key. */
export function categoryKey(category: string): string {
  const parts = category.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return parts.map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))).join("");
}

/** 30 -> "0:30". */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return Math.floor(safe / 60) + ":" + String(safe % 60).padStart(2, "0");
}

/**
 * Fact ids are not always spelled the same on both sides
 * ("curtains_daylight" vs "daylight_curtains"), so compare word sets.
 */
export function normalizeFactId(id: string): string {
  return id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join("-");
}

/** The two clips after this one, wrapping round — "Up next". */
export function nextClips(currentId: string, count = 2): LearnClip[] {
  const index = LEARN_CLIPS.findIndex((clip) => clip.id === currentId);
  if (index < 0) return [];
  return Array.from({ length: Math.min(count, LEARN_CLIPS.length - 1) }, (_, offset) => LEARN_CLIPS[(index + offset + 1) % LEARN_CLIPS.length]);
}

const CATEGORY_ART: Record<string, IconName> = {
  cooling: "ac",
  standby: "bolt",
  lighting: "bulb",
  kitchen: "fridge",
  hotWater: "geyser",
  daylight: "sun",
  bills: "bill",
  proof: "check",
};

/** A reusable illustration for a category's poster placeholder. */
export function categoryArt(category: string): IconName {
  return CATEGORY_ART[categoryKey(category)] ?? "book";
}