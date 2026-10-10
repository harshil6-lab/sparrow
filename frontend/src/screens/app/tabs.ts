import type { TFunction } from "i18next";
import type { IconName } from "../../components/Icon";
import { FEATURE_SOLAR } from "../../lib/env";

export type TabId = "home" | "missions" | "learn" | "solar" | "me";

export const TAB_PATHS: Record<TabId, string> = {
  home: "/app",
  missions: "/app/missions",
  learn: "/app/learn",
  solar: "/app/solar",
  me: "/app/me",
};

/** Which tab a pathname shows. Solar only resolves when the feature flag is on. */
export function tabFromPath(pathname: string): TabId {
  if (pathname.startsWith("/app/missions")) return "missions";
  if (pathname.startsWith("/app/learn")) return "learn";
  if (pathname.startsWith("/app/me")) return "me";
  if (pathname.startsWith("/app/solar")) return FEATURE_SOLAR ? "solar" : "home";
  return "home";
}

/** The visible tabs. Solar is dropped entirely while the feature flag is off. */
export function navItems(t: TFunction): { id: TabId; label: string; icon: IconName }[] {
  const items: { id: TabId; label: string; icon: IconName }[] = [
    { id: "home", label: t("app.tabsHome"), icon: "home" },
    { id: "missions", label: t("app.tabsMissions"), icon: "bolt" },
    { id: "learn", label: t("app.tabsLearn"), icon: "book" },
    { id: "solar", label: t("app.tabsSolar"), icon: "sun" },
    { id: "me", label: t("app.tabsMe"), icon: "user" },
  ];
  return FEATURE_SOLAR ? items : items.filter((item) => item.id !== "solar");
}