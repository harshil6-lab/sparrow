/**
 * Learn cards, read from data/facts.json (mirrored into src/data so Vite can
 * bundle it). The JSON holds structure only — icon, copy keys, sources,
 * claims and clip —
 * because every visible string is an i18n key (`learn.<id>.*`).
 *
 * Hard rule: a card without a real source URL must not carry a numeric savings
 * claim. `visibleNote` enforces that at render time, so a claim can never leak
 * into the UI just because someone edited copy.
 */
import rawFacts from "../data/facts.json";
import { ICON_NAMES, type IconName } from "../components/Icon";

export interface FactCard {
  id: string;
  icon: IconName;
  habit: string;
  better_habit: string;
  why: string;
  sources: Source[];
  claims?: Claim[];
  /** A configured clip URL, or null (the clip sheet then says "Coming soon"). */
  clip: string | null;
}

export interface Source {
  publisher: string;
  title: string;
  url: string;
  accessed: string;
}

export interface Claim {
  text: string;
  kind: "estimate" | "fact";
  value: number;
}

interface RawCard {
  id: string;
  icon: string;
  habit: string;
  better_habit: string;
  why: string;
  sources?: Source[];
  claims?: Claim[];
  clip: string | null;
}

function toIconName(value: string): IconName {
  return (ICON_NAMES as readonly string[]).includes(value) ? (value as IconName) : "book";
}

export const FACTS: FactCard[] = (rawFacts.cards as RawCard[]).map((card) => ({
  id: card.id,
  icon: toIconName(card.icon),
  habit: card.habit,
  better_habit: card.better_habit,
  why: card.why,
  sources: card.sources ?? [],
  claims: card.claims,
  clip: card.clip ?? null,
}));

/**
 * Percentages, kWh/kW/W figures and rupee amounts are "savings claims".
 * A set-point temperature (24–26°C) is guidance, not a claim, so it passes.
 */
const NUMERIC_CLAIM =
  /\d+(?:[.,]\d+)?\s*%|\d+(?:[.,]\d+)?\s*kWh|\d+(?:[.,]\d+)?\s*kW\b|₹\s*\d|\bRs\.?\s*\d/i;

export function hasNumericClaim(text: string): boolean {
  return NUMERIC_CLAIM.test(text);
}

/**
 * The text to show: unchanged when the card cites a source, otherwise dropped
 * when it carries a numeric claim. Null means "render nothing".
 */
export function visibleNote(text: string, hasSource: boolean): string | null {
  if (hasSource) return text;
  return hasNumericClaim(text) ? null : text;
}

export function hasCitableSource(card: Pick<FactCard, "sources">): boolean {
  return card.sources.some((source) => source.url.startsWith("https://"));
}
