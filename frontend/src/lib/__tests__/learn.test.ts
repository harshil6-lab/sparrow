import { describe, expect, it } from "vitest";
import { FACTS, hasNumericClaim, visibleNote } from "../learn";

/**
 * Hard rule: a card with no cited source must not carry a numeric savings
 * claim. `visibleNote` is the render-time guard, so copy edits cannot leak one.
 */
describe("Learn numeric-claim guard", () => {
  it("drops a claim when the card has no source", () => {
    expect(visibleNote("Saves 20% on cooling", false)).toBeNull();
    expect(visibleNote("Saves 1.5 kWh a day", false)).toBeNull();
    expect(visibleNote("Keeps Rs 300 a month", false)).toBeNull();
  });

  it("keeps the same claim once a real source URL is cited", () => {
    const url = "https://example.gov/verified";
    expect(visibleNote("Saves 20% on cooling", Boolean(url))).toBe("Saves 20% on cooling");
  });

  it("never treats a set-point temperature as a claim", () => {
    expect(hasNumericClaim("Set 24-26\u00b0C and use a fan")).toBe(false);
    expect(visibleNote("Set 24-26\u00b0C and use a fan", false)).toBe("Set 24-26\u00b0C and use a fan");
  });

  it("ships six sourced cards and every numeric claim has an https source", () => {
    expect(FACTS.map((card) => card.id)).toEqual([
      "ac_setpoint",
      "standby_power",
      "led_swap",
      "fridge_door",
      "geyser_use",
      "daylight_curtains",
    ]);
    expect(FACTS.every((card) => card.sources.every((source) => source.url.startsWith("https://")))).toBe(true);
    expect(["ac_setpoint", "led_swap"].every((id) => {
      const card = FACTS.find((item) => item.id === id);
      return Boolean(card?.claims?.length && card.sources.some((source) => source.url.startsWith("https://")));
    })).toBe(true);
    expect(FACTS.every((card) => card.clip === null)).toBe(true);
    expect(JSON.stringify(FACTS).toLowerCase()).not.toContain("hot food");
  });

  it("marks estimate claims with the translated estimate label", () => {
    expect(FACTS.find((card) => card.id === "ac_setpoint")?.claims?.[0].kind).toBe("estimate");
  });
});