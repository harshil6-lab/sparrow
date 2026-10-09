import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Icon, type IconName } from "../../components/Icon";
import { SparrowLogo } from "../../components/SparrowLogo";
import { SparrowMascot } from "../../components/SparrowMascot";
import { SheetPortalContext } from "../../components/ui/sheetPortal";
import { api } from "../../lib/api";
import type { Dashboard } from "../../lib/api/data";
import { useAuth } from "../../lib/AuthProvider";
import { worldState } from "../../lib/world";
import { ProfileSheet } from "./ProfileSheet";
import { HomeTab } from "./HomeTab";
import { SweepSheet } from "./SweepSheet";
import { BillSheet } from "./BillSheet";
import { ResultSheet } from "./ResultSheet";
import { ShareSheet } from "./ShareSheet";

type TabId = "home" | "missions" | "learn" | "solar" | "me";
type Overlay = "sweep" | "bill" | "result" | "share" | null;

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
 * App shell for /app/*. Home renders the proof loop (world state from verified
 * bills, sweep, bill sheet, verification and share card). The other four tabs
 * keep their Run B placeholders. All sheets are portaled into the frame so they
 * stay inside the app column at >=900px.
 */
export function AppShell() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sweepStartComplete, setSweepStartComplete] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashError, setDashError] = useState(false);
  const [shareKwh, setShareKwh] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setFrameEl(frameRef.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!profile) return;
    setDashError(false);
    try {
      setDashboard(await api.data.getDashboard(profile.user));
    } catch {
      setDashError(true);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const bills = dashboard?.bills ?? [];
  const demo = dashboard?.demo ?? false;
  const missionDone = dashboard?.missionDone ?? false;
  const state = worldState(bills);
  const items = navItems(t);

  const completeSweep = useCallback(async () => {
    if (profile) await api.data.completeMission(profile.user);
    await refresh();
    setOverlay(null);
  }, [profile, refresh]);

  const openShare = useCallback((kwh: number) => {
    setShareKwh(kwh);
    setOverlay("share");
  }, []);

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

  const home = dashError ? (
    <div className="page">
      <div className="list-state">
        <Icon name="bill" size={34} />
        <strong>{t("home.loadError")}</strong>
        <p>{t("home.loadErrorHint")}</p>
        <button className="quiet-button" onClick={() => void refresh()}>
          {t("home.retry")}
        </button>
      </div>
    </div>
  ) : !dashboard ? (
    <div className="page">
      <div className="loading-state">
        <span className="spinner" />
        <h2>{t("home.loading")}</h2>
      </div>
    </div>
  ) : (
    <HomeTab
      state={state}
      bills={bills}
      missionDone={missionDone}
      demo={demo}
      onBill={() => setOverlay("bill")}
      onSweep={() => {
        setSweepStartComplete(false);
        setOverlay("sweep");
      }}
      onOpenMission={() => {
        setSweepStartComplete(true);
        setOverlay("sweep");
      }}
      onResult={() => setOverlay("result")}
    />
  );

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

        {tab === "home" ? (
          home
        ) : (
          <div className="page">
            <div className="empty-state">
              <SparrowMascot pose="curious" size={70} />
              <div>
                <strong>{t(placeholderKeys[tab])}</strong>
                <span>{t("app.runBPlaceholder")}</span>
              </div>
            </div>
          </div>
        )}
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
        <SweepSheet
          open={overlay === "sweep"}
          onClose={() => setOverlay(null)}
          startComplete={sweepStartComplete}
          onDone={completeSweep}
        />
        <BillSheet
          open={overlay === "bill"}
          onClose={() => setOverlay(null)}
          demo={demo}
          previousBill={bills[0] ?? null}
          onSaved={refresh}
          onShare={openShare}
        />
        <ResultSheet
          open={overlay === "result"}
          onClose={() => setOverlay(null)}
          bills={bills}
          demo={demo}
          onShare={openShare}
        />
        <ShareSheet
          open={overlay === "share"}
          onClose={() => setOverlay(null)}
          kwh={shareKwh}
          demo={demo}
        />
      </SheetPortalContext.Provider>
    </div>
  );
}