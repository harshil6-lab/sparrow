import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { FEATURE_SOLAR } from "../../../lib/env";
import { TAB_PATHS, navItems, tabFromPath } from "../tabs";

describe("tab routing and the Solar flag", () => {
  it("defaults VITE_FEATURE_SOLAR to off", () => {
    expect(FEATURE_SOLAR).toBe(false);
  });

  it("maps each app path to its tab", () => {
    expect(tabFromPath("/app")).toBe("home");
    expect(tabFromPath("/app/missions")).toBe("missions");
    expect(tabFromPath("/app/learn")).toBe("learn");
    expect(tabFromPath("/app/me")).toBe("me");
  });

  it("never resolves the Solar route while the flag is off", () => {
    expect(FEATURE_SOLAR).toBe(false);
    expect(tabFromPath(TAB_PATHS.solar)).toBe("home");
    expect(navItems(i18n.t).map((item) => item.id)).toEqual(["home", "missions", "learn", "me"]);
  });
});