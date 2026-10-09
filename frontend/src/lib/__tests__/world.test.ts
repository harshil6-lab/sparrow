import { describe, expect, it } from "vitest";
import { worldState } from "../world";
import type { Bill } from "../api/data";

const bill = (units: number, month = "2025-06"): Bill => ({
  id: `b_${month}_${units}`,
  month,
  units,
  verified: false,
  createdAt: "2025-06-01T00:00:00.000Z",
});

/** bills are newest-first, so pass [latest, previous]. */
const pair = (latest: number, previous: number) => [bill(latest, "2025-06"), bill(previous, "2025-05")];

describe("worldState", () => {
  it("is dawn for a brand-new Nest (no bills)", () => {
    expect(worldState([])).toBe("dawn");
  });

  it("is dawn with only one bill (no comparison possible)", () => {
    expect(worldState([bill(200)])).toBe("dawn");
  });

  it("is dawn when usage is unchanged", () => {
    expect(worldState(pair(200, 200))).toBe("dawn");
  });

  it("is thriving at a drop of exactly 15%", () => {
    expect(worldState(pair(170, 200))).toBe("thriving");
  });

  it("is thriving above 15%", () => {
    expect(worldState(pair(80, 200))).toBe("thriving");
  });

  it("is fresh just under 15% (14.9%)", () => {
    expect(worldState(pair(851, 1000))).toBe("fresh");
  });

  it("is fresh at a drop of exactly 5%", () => {
    expect(worldState(pair(95, 100))).toBe("fresh");
  });

  it("is dawn just under 5% (4.9%)", () => {
    expect(worldState(pair(95.1, 100))).toBe("dawn");
  });

  it("is dawn when usage is up by exactly 5% (within tolerance)", () => {
    expect(worldState(pair(105, 100))).toBe("dawn");
  });

  it("is hazy when usage is up by more than 5%", () => {
    expect(worldState(pair(105.1, 100))).toBe("hazy");
    expect(worldState(pair(150, 100))).toBe("hazy");
  });

  it("ignores the third bill and older history (latest vs previous only)", () => {
    expect(worldState([bill(200, "2025-06"), bill(100, "2025-05"), bill(500, "2025-04")])).toBe("hazy");
  });
});