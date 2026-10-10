import { describe, expect, it } from "vitest";
import billPayloads from "../../../../contracts/bill-payloads.json";
import {
  buildBillPayload,
  currentMonthKey,
  parseAmount,
  parseUnits,
  validateAmount,
  validateUnits,
} from "../bills";

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

  it("rejects decimal readings", () => {
    expect(validateUnits("186.5")).toBe("range");
  });

  it("defaults the month picker to the current month", () => {
    expect(currentMonthKey(new Date(2025, 5, 15))).toBe("2025-06");
    expect(currentMonthKey(new Date(2025, 11, 1))).toBe("2025-12");
  });

  describe("bill payload contract", () => {
    it("builds the valid contract examples exactly", () => {
      expect(buildBillPayload("2026-08", 186)).toEqual(billPayloads.valid[0]);
      expect(buildBillPayload("2026-09", 170, 1500)).toEqual(billPayloads.valid[1]);
    });

    it("never includes an empty amount", () => {
      expect(buildBillPayload("2026-08", 186, null)).toEqual(billPayloads.valid[0]);
    });
  });
});

describe("optional bill amount validation", () => {
  it("accepts an empty amount (the field is optional)", () => {
    expect(validateAmount("")).toBeNull();
    expect(validateAmount("   ")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("accepts the inclusive 1-100000 range", () => {
    expect(validateAmount("1")).toBeNull();
    expect(validateAmount("1500")).toBeNull();
    expect(validateAmount("100000")).toBeNull();
  });

  it("rejects values outside the range", () => {
    expect(validateAmount("0")).toBe("range");
    expect(validateAmount("100001")).toBe("range");
    expect(validateAmount("-10")).toBe("range");
  });

  it("rejects non-numbers", () => {
    expect(validateAmount("abc")).toBe("range");
    expect(parseAmount("abc")).toBeNull();
  });
});
