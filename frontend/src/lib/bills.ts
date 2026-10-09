/**
 * Shared bill input rules. The bill sheet validates inline against these, and
 * the tests pin the boundaries (required, number, 1-5000).
 */
export const UNITS_MIN = 1;
export const UNITS_MAX = 5000;

/** Which inline error to show, or null when the value is valid. */
export type UnitsError = "required" | "range" | null;

export function parseUnits(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function validateUnits(raw: string): UnitsError {
  if (!raw.trim()) return "required";
  const value = parseUnits(raw);
  if (value === null || value < UNITS_MIN || value > UNITS_MAX) return "range";
  return null;
}

/** Current billing month as "YYYY-MM" (the month picker default). */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}