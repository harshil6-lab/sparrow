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
  return Number.isInteger(value) && Number.isFinite(value) ? value : null;
}

export function validateUnits(raw: string): UnitsError {
  if (!raw.trim()) return "required";
  const value = parseUnits(raw);
  if (value === null || value < UNITS_MIN || value > UNITS_MAX) return "range";
  return null;
}

/**
 * Optional bill amount in rupees. The user's own bill is the only source of
 * rupee figures, so the field is optional and never required.
 */
export const AMOUNT_MIN = 1;
export const AMOUNT_MAX = 100000;

/** Which inline error to show for the optional amount, or null when valid. */
export type AmountError = "range" | null;

export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && Number.isFinite(value) ? value : null;
}

/** Empty is valid (the amount is optional). When present it must be 1-100000. */
export function validateAmount(raw: string): AmountError {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = parseAmount(raw);
  if (value === null || value < AMOUNT_MIN || value > AMOUNT_MAX) return "range";
  return null;
}

export interface BillPayload {
  month: string;
  units: number;
  amount?: number;
}

/** Builds the exact POST /bills body; optional amount is omitted, never null. */
export function buildBillPayload(month: string, units: number, amount?: number | null): BillPayload {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("month must be formatted as YYYY-MM");
  if (!Number.isInteger(units) || units < UNITS_MIN || units > UNITS_MAX) {
    throw new Error("units must be an integer between 1 and 5000");
  }
  if (amount !== undefined && amount !== null && (!Number.isInteger(amount) || amount < AMOUNT_MIN || amount > AMOUNT_MAX)) {
    throw new Error("amount must be an integer between 1 and 100000");
  }
  return {
    month,
    units,
    ...(amount !== undefined && amount !== null ? { amount } : {}),
  };
}

/** Current billing month as "YYYY-MM" (the month picker default). */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return value === 1 ? `${year - 1}-12` : `${year}-${String(value - 1).padStart(2, "0")}`;
}

export function isPlausibilityWarning(previousUnits: number, nextUnits: number): boolean {
  return nextUnits > previousUnits * 3 || nextUnits < previousUnits / 3;
}
