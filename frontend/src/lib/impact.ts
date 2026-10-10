/**
 * Impact engine, ported from backend/impact.py so the client and the server
 * agree on every number. No hidden constants.
 */

export interface MissionResult {
  kwhSaved: number;
  dropPct: number;
  verified: boolean;
}

/** Round half to even, matching Python's built-in round(). */
function roundHalfEven(value: number, decimals: number): number {
  const m = 10 ** decimals;
  const scaled = value * m;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  if (Math.abs(diff - 0.5) < 1e-9) {
    return (floor % 2 === 0 ? floor : floor + 1) / m;
  }
  return Math.round(scaled) / m;
}

/**
 * Verify a change between two bills. Units are kWh per month.
 * Mirrors backend/impact.py `mission_result`.
 */
export function missionResult(baselineUnits: number, newUnits: number, minDropPct = 5): MissionResult {
  if (!(baselineUnits > 0)) throw new Error("baseline_units must be > 0");
  const saved = Math.max(baselineUnits - newUnits, 0);
  const dropPct = (100 * (baselineUnits - newUnits)) / baselineUnits;
  return {
    kwhSaved: roundHalfEven(saved, 2),
    dropPct: roundHalfEven(dropPct, 1),
    verified: dropPct >= minDropPct,
  };
}

/**
 * kWh saved -> CO2 avoided. The emission factor must come from
 * data/config.json; a null factor throws rather than inventing a number.
 */
export function co2Kg(kwhSaved: number, factor: number | null): number {
  if (factor === null) {
    throw new Error("grid emission factor not set; fill data/config.json from a cited source");
  }
  if (kwhSaved < 0) throw new Error("kwh_saved must be >= 0");
  return kwhSaved * factor;
}

/**
 * kWh saved -> rupees kept, using the user's OWN average rate taken from the
 * baseline bill: baseline_amount / baseline_units. Returns null when the baseline
 * bill has no amount, so the UI prompts for it instead of inventing a tariff.
 * Mirrors backend/impact.py `rupees_saved`.
 */
export function rupeesSaved(
  kwhSaved: number,
  baselineAmount: number | null | undefined,
  baselineUnits: number,
): number | null {
  if (baselineAmount === null || baselineAmount === undefined) return null;
  if (!(baselineUnits > 0)) return null;
  if (kwhSaved < 0) throw new Error("kwh_saved must be >= 0");
  return kwhSaved * (baselineAmount / baselineUnits);
}

/** kWh for display: one decimal (integers stay whole). */
export function formatKwhForDisplay(kwhSaved: number): string {
  const rounded = Math.round(kwhSaved * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** CO2 for display: whole kg, or one decimal below 10 kg. */
export function formatCo2KgForDisplay(kg: number): string {
  return kg < 10 ? (Math.round(kg * 10) / 10).toFixed(1) : String(Math.round(kg));
}

/** Rupees for display: nearest whole rupee, grouped for Indian reading. */
export function formatRupeesForDisplay(inr: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(inr));
}

/**
 * A projection, not a measurement. Label it as such in the UI.
 * Mirrors backend/impact.py `scale_projection`.
 */
export function scaleProjection(kwhSavedPerHome: number, homes: number): number {
  return kwhSavedPerHome * homes;
}
