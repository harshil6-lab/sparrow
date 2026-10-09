import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Icon, type IconName } from "../../components/Icon";
import { SparrowLogo } from "../../components/SparrowLogo";
import { SparrowMascot } from "../../components/SparrowMascot";
import { ProfileSheet } from "./ProfileSheet";
import { SheetPortalContext } from "../../components/ui/sheetPortal";
import { useAuth } from "../../lib/AuthProvider";

type TabId = "home" | "missions" | "learn" | "solar" | "me";

function navItems(t: TFunction): { id: TabId; label: string; icon: IconName }[] {
  return [
    { id: "home", label: t("app.tabsHome"), icon: "home" },
    { id: "missions", label: t("app.tabsMissions"), icon: "bolt" },
    { id: "learn", label: t("app.tabsLearn"), icon: "book" },
    { id: "solar", label: t("app.tabsSolar"), icon: "sun" },
    { id: "me", label: t("app.tabsMe"), icon: "user" },
  ];
}

/**
 * App shell stub for /app/*. Renders "Run B" placeholders for each tab and a
 * tappable avatar that opens the profile sheet. No AWS wiring — the tab
 * screens arrive in Run B.
 */
export function AppShell() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setFrameEl(frameRef.current);
  }, []);
  const items = navItems(t);

  const initials = (profile?.user.displayName ?? "S")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const placeholderKeys: Record<TabId, string> = {
    home: "app.runBHome",
    missions: "app.runBMissions",
    learn: "app.runBLearn",
    solar: "app.runBSolar",
    me: "app.runBMe",
  };

  return (
    <div className="app-shell" data-app-frame ref={frameRef}>
      <aside className="side-nav">
        <SparrowLogo />
        <nav>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button type="button" className="side-settings" onClick={() => setProfileOpen(true)}>
          <Icon name="settings" /> {t("app.profileTitle")}
        </button>
      </aside>

      <main className="app-main" data-app-scroll>
        <header data-app-header>
          <div className="mobile-logo">
            <SparrowLogo />
          </div>
          <div>
            <span>{t("app.nestName")}</span>
            <strong>{profile?.user.displayName ?? t("app.greeting")}</strong>
          </div>
          <button
            type="button"
            className="avatar"
            aria-label={t("app.openProfile")}
            onClick={() => setProfileOpen(true)}
          >
            {initials}
          </button>
        </header>

        <div className="page">
          <div className="empty-state">
            <SparrowMascot pose="curious" size={70} />
            <div>
              <strong>{t(placeholderKeys[tab])}</strong>
              <span>{t("app.runBPlaceholder")}</span>
            </div>
          </div>
        </div>
      </main>

      <nav className="bottom-nav" data-app-tabbar aria-label={t("app.nestName")}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <SheetPortalContext.Provider value={frameEl}>
        <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      </SheetPortalContext.Provider>
    </div>
  );
}
