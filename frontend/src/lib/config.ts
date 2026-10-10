/**
 * Typed reader for data/config.json.
 *
 * Hard product rule: a null constant is never invented. When
 * `grid_emission_factor_kg_per_kwh` or `tariff_slabs` is null the UI hides the
 * figure and shows "source pending" instead.
 */
import raw from "../data/config.json";

export interface SparrowConfig {
  gridEmissionFactorKgPerKwh: number | null;
  /** Citation for the grid emission factor (CEA database, version, year). */
  gridEmissionFactorSource: string | null;
  gridEmissionFactorUrl: string | null;
  tariffSlabs: unknown | null;
  tariffNote: string | null;
  solarSubsidyTerms: unknown | null;
  solarSubsidySource: string | null;
}

export const config: SparrowConfig = {
  gridEmissionFactorKgPerKwh: raw.grid_emission_factor_kg_per_kwh,
  gridEmissionFactorSource: raw.grid_emission_factor_source,
  gridEmissionFactorUrl: raw.grid_emission_factor_url,
  tariffSlabs: raw.tariff_slabs,
  tariffNote: raw.tariff_note,
  solarSubsidyTerms: raw.solar_subsidy_terms,
  solarSubsidySource: raw.solar_subsidy_source,
};

/** True only when a cited grid emission factor exists. */
export const hasEmissionFactor = config.gridEmissionFactorKgPerKwh !== null;

/**
 * True only when a cited tariff schedule exists. Rupee figures derived from the
 * user's own bill do not depend on this; tariff_slabs still guards the Solar tab.
 */
export const hasTariff = config.tariffSlabs !== null;

/**
 * The emission factor to use, or null when it is unsourced. Never hardcode one.
 */
export function emissionFactor(): number | null {
  return config.gridEmissionFactorKgPerKwh;
}
