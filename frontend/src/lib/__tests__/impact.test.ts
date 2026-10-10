import { describe, expect, it } from "vitest";
import {
  co2Kg,
  formatCo2KgForDisplay,
  formatKwhForDisplay,
  formatRupeesForDisplay,
  missionResult,
  rupeesSaved,
  scaleProjection,
} from "../impact";

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

  it("computes rupees from the user's own baseline bill", () => {
    expect(rupeesSaved(30, 1500, 200)).toBe(225);
  });

  it("returns null rupees when the baseline bill has no amount", () => {
    expect(rupeesSaved(30, null, 200)).toBeNull();
    expect(rupeesSaved(30, undefined, 200)).toBeNull();
    expect(rupeesSaved(30, 1500, 0)).toBeNull();
  });

  it("rejects negative kWh saved for rupees too", () => {
    expect(() => rupeesSaved(-1, 1500, 200)).toThrow();
  });

  it("formats figures for display (kWh 1dp, CO2 whole or 1dp under 10, rupees whole)", () => {
    expect(formatKwhForDisplay(30)).toBe("30");
    expect(formatKwhForDisplay(29.6)).toBe("29.6");
    expect(formatCo2KgForDisplay(21.3)).toBe("21");
    expect(formatCo2KgForDisplay(0.71)).toBe("0.7");
    expect(formatRupeesForDisplay(225)).toBe("225");
    expect(formatRupeesForDisplay(1500)).toBe("1,500");
  });
});
