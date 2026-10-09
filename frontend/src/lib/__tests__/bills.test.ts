import { describe, expect, it } from "vitest";
import { currentMonthKey, parseUnits, validateUnits } from "../bills";

describe("bill unit validation", () => {
  it("requires a value", () => {
    expect(validateUnits("")).toBe("required");
    expect(validateUnits("   ")).toBe("required");
  });

  it("accepts the inclusive 1-5000 range", () => {
    expect(validateUnits("1")).toBeNull();
    expect(validateUnits("186")).toBeNull();
    expect(validateUnits("5000")).toBeNull();
  });

  it("rejects values outside the range", () => {
    expect(validateUnits("0")).toBe("range");
    expect(validateUnits("5001")).toBe("range");
    expect(validateUnits("-12")).toBe("range");
  });

  it("rejects non-numbers", () => {
    expect(validateUnits("abc")).toBe("range");
    expect(parseUnits("abc")).toBeNull();
  });

  it("defaults the month picker to the current month", () => {
    expect(currentMonthKey(new Date(2025, 5, 15))).toBe("2025-06");
    expect(currentMonthKey(new Date(2025, 11, 1))).toBe("2025-12");
  });
});