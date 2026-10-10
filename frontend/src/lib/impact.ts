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
 * A projection, not a measurement. Label it as such in the UI.
 * Mirrors backend/impact.py `scale_projection`.
 */
export function scaleProjection(kwhSavedPerHome: number, homes: number): number {
  return kwhSavedPerHome * homes;
}