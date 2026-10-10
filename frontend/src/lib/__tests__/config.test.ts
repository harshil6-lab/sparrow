import { afterEach, describe, expect, it, vi } from "vitest";

/** The hard product rule: a null constant is never invented or shown. */
describe("config null guard", () => {
  afterEach(() => {
    vi.doUnmock("../../data/config.json");
    vi.resetModules();
  });

  it("hides the CO2 figure and the tariff when the values are null", async () => {
    vi.resetModules();
    vi.doMock("../../data/config.json", () => ({
      default: {
        grid_emission_factor_kg_per_kwh: null,
        grid_emission_factor_source: "TODO",
        grid_emission_factor_url: null,
        tariff_slabs: null,
        tariff_note: null,
        solar_subsidy_terms: null,
        solar_subsidy_source: "TODO",
      },
    }));
    const mod = await import("../config");
    expect(mod.hasEmissionFactor).toBe(false);
    expect(mod.emissionFactor()).toBeNull();
    expect(mod.hasTariff).toBe(false);
  });

  it("exposes the sourced CEA factor and still hides the null tariff", async () => {
    vi.resetModules();
    const mod = await import("../config");
    expect(mod.hasEmissionFactor).toBe(true);
    expect(mod.emissionFactor()).toBeCloseTo(0.71, 6);
    expect(mod.config.gridEmissionFactorSource).toMatch(/CEA CO2 Baseline Database/);
    expect(mod.config.gridEmissionFactorSource).toMatch(/Version 21\.0/);
    expect(mod.config.gridEmissionFactorUrl).toMatch(/^https:\/\/cea\.nic\.in\//);
    expect(mod.hasTariff).toBe(false);
    expect(mod.config.tariffSlabs).toBeNull();
    expect(mod.config.tariffNote).toMatch(/own bill/);
    expect(mod.config.solarSubsidyTerms).not.toBeNull();
    expect(mod.config.solarSubsidySource).toMatch(/PM-Surya Ghar/);
  });
});
