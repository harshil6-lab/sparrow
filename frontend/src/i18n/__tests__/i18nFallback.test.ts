import { describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { LANGUAGES, languageMeta } from "../../i18n/languages";

describe("i18n fallback to English", () => {
  it("resolves Hindi keys to Hindi text", async () => {
    await i18n.changeLanguage("hi");
    expect(i18n.t("setup.stepOf", { n: 1 })).toBe("चरण 1 / 5");
    expect(i18n.t("splash.enter")).toBe("स्पैरो में आएँ");
  });

  it("translates every required key for Hindi", async () => {
    await i18n.changeLanguage("hi");
    const required = [
      "splash.tagline", "welcome.build", "login.title", "login.continueGoogle",
      "setup.homeTitle", "setup.cityUnlisted", "setup.applianceAc", "ready.title",
      "setup.stepOf",
    ];
    for (const key of required) {
      const value = i18n.t(key, { n: 1 });
      expect(value).not.toBe("");
      expect(value).not.toBe(key);
    }
  });

  it("falls back to English for unreviewed languages", async () => {
    await i18n.changeLanguage("ta");
    expect(i18n.t("splash.enter")).toBe("Enter Sparrow");
    expect(i18n.t("setup.stepOf", { n: 1 })).toBe("Step 1 of 5");
  });

  it("marks every non-Hindi, non-English language as beta", () => {
    const beta = LANGUAGES.filter((l) => !l.reviewed).map((l) => l.code);
    expect(beta).toEqual(["gu", "mr", "bn", "ta", "te", "kn", "ml", "pa"]);
  });

  it("lists all ten languages in their own script", () => {
    expect(LANGUAGES).toHaveLength(10);
    expect(LANGUAGES.map((l) => l.code)).toEqual(["en", "hi", "gu", "mr", "bn", "ta", "te", "kn", "ml", "pa"]);
    expect(languageMeta("hi").native).toBe("हिन्दी");
    expect(languageMeta("en").reviewed).toBe(true);
  });
});
