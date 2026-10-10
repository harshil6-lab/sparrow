import { describe, expect, it } from "vitest";
import { FACTS, hasNumericClaim, visibleNote } from "../learn";

/**
 * Hard rule: a card with no cited source must not carry a numeric savings
 * claim. `visibleNote` is the render-time guard, so copy edits cannot leak one.
 */
describe("Learn numeric-claim guard", () => {
  it("drops a claim when the card has no source", () => {
    expect(visibleNote("Saves 20% on cooling", null)).toBeNull();
    expect(visibleNote("Saves 1.5 kWh a day", null)).toBeNull();
    expect(visibleNote("Keeps Rs 300 a month", null)).toBeNull();
  });

  it("keeps the same claim once a real source URL is cited", () => {
    const url = "https://example.gov/verified";
    expect(visibleNote("Saves 20% on cooling", url)).toBe("Saves 20% on cooling");
  });

  it("never treats a set-point temperature as a claim", () => {
    expect(hasNumericClaim("Set 24-26\u00b0C and use a fan")).toBe(false);
    expect(visibleNote("Set 24-26\u00b0C and use a fan", null)).toBe("Set 24-26\u00b0C and use a fan");
  });

  it("ships the six designed cards with no invented source", () => {
    expect(FACTS.map((card) => card.id)).toEqual([
      "ac_setpoint",
      "standby_power",
      "led_swap",
      "fridge_door",
      "geyser_use",
      "daylight_curtains",
    ]);
    expect(FACTS.every((card) => card.source === null)).toBe(true);
    expect(FACTS.every((card) => card.clip === null)).toBe(true);
  });
});