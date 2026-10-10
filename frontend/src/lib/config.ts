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
  tariffSlabs: unknown | null;
  solarSubsidyTerms: unknown | null;
}

export const config: SparrowConfig = {
  gridEmissionFactorKgPerKwh: raw.grid_emission_factor_kg_per_kwh,
  tariffSlabs: raw.tariff_slabs,
  solarSubsidyTerms: raw.solar_subsidy_terms,
};

/** True only when a cited grid emission factor exists. */
export const hasEmissionFactor = config.gridEmissionFactorKgPerKwh !== null;

/** True only when a cited tariff exists. Rupee figures stay hidden until then. */
export const hasTariff = config.tariffSlabs !== null;

/**
 * The emission factor to use, or null when it is unsourced. Never hardcode one.
 */
export function emissionFactor(): number | null {
  return config.gridEmissionFactorKgPerKwh;
}