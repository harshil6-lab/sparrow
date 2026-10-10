import { describe, expect, it } from "vitest";
import { co2Kg, missionResult, scaleProjection } from "../impact";

/**
 * Parity cases mirroring backend/tests/test_impact.py so the client and the
 * server agree on every number.
 */
describe("impact.ts (parity with backend/impact.py)", () => {
  it("verifies a 200 -> 170 kWh month", () => {
    const r = missionResult(200, 170);
    expect(r.kwhSaved).toBe(30);
    expect(r.dropPct).toBe(15);
    expect(r.verified).toBe(true);
  });

  it("does not verify a small drop (200 -> 198)", () => {
    expect(missionResult(200, 198).verified).toBe(false);
  });

  it("never reports negative savings (100 -> 120)", () => {
    expect(missionResult(100, 120).kwhSaved).toBe(0);
  });

  it("rejects a non-positive baseline", () => {
    expect(() => missionResult(0, 5)).toThrow();
  });

  it("requires an emission factor", () => {
    expect(() => co2Kg(10, null)).toThrow();
  });

  it("computes CO2 with an explicit factor", () => {
    expect(co2Kg(10, 0.5)).toBe(5);
  });

  it("rejects negative kWh saved", () => {
    expect(() => co2Kg(-1, 0.5)).toThrow();
  });

  it("scales a clearly-labelled projection", () => {
    expect(scaleProjection(30, 10)).toBe(300);
  });
});