import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowLogo } from "../../components/SparrowLogo";
import { SheetPortalContext } from "../../components/ui/sheetPortal";
import { api } from "../../lib/api";
import { DEFAULT_SETTINGS, type Dashboard, type Settings } from "../../lib/api/data";
import { useAuth } from "../../lib/AuthProvider";
import { FEATURE_SOLAR, LEARN_CLIP_URL } from "../../lib/env";
import { FACTS } from "../../lib/learn";
import type { SetupAnswers } from "../../lib/types";
import { worldState } from "../../lib/world";
import { ProfileSheet } from "./ProfileSheet";
import { HomeTab } from "./HomeTab";
import { MissionsTab } from "./MissionsTab";
import { LearnTab } from "./LearnTab";
import { MeTab, verifiedTotals } from "./MeTab";
import { CommunityTab } from "./CommunityTab";
import { SweepSheet } from "./SweepSheet";
import { BillSheet } from "./BillSheet";
import { ResultSheet } from "./ResultSheet";
import { ShareSheet } from "./ShareSheet";
import { ClipSheet, LearnDetailSheet, MissionDetailSheet } from "./DetailSheets";
import { BillsSheet, ConfirmSheet, NestSheet } from "./ProfileSheets";
import { TabError, TabLoading } from "./TabState";
import { TAB_PATHS, navItems, tabFromPath, type TabId } from "./tabs";
import { clearDemo } from "../../lib/demo";
import { resetApi } from "../../lib/api";

type Overlay =
  | "sweep"
  | "bill"
  | "result"
  | "share"
  | "mission"
  | "learn"
  | "clip"
  | "nest"
  | "bills"
  | "delete"
  | "reset"
  | "signout"
  | null;

/**
 * App shell for /app/*. The tab is driven by the route. Solar is behind
 * VITE_FEATURE_SOLAR (off by default) so the tab bar shows four tabs and the
 * Solar route is not reachable. Sheets are portaled into the app frame so they
 * stay inside the app column at >=900px.
 */
export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, saveProfile, deleteAccount, resetDemo } = useAuth();
  const tab = tabFromPath(location.pathname);

  const [profileOpen, setProfileOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [sweepStartComplete, setSweepStartComplete] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashError, setDashError] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [shareKwh, setShareKwh] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setFrameEl(frameRef.current);
  }, []);

  // The Solar route is not reachable while the feature flag is off.
  useEffect(() => {
    if (!FEATURE_SOLAR && location.pathname.startsWith(TAB_PATHS.solar)) {
      navigate(TAB_PATHS.home, { replace: true });
    }
  }, [location.pathname, navigate]);

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

  useEffect(() => {
    if (!profile) return;
    let active = true;
    void (async () => {
      const stored = await api.data.getSettings(profile.user);
      if (active) setSettings(stored);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  const saveSettings = useCallback(
    async (next: Settings) => {
      if (!profile) return;
      setSettings(next);
      await api.data.saveSettings(profile.user, next);
    },
    [profile],
  );

  const bills = dashboard?.bills ?? [];
  const demo = dashboard?.demo ?? false;
  const missionDone = dashboard?.missionDone ?? false;
  const missionsDone = dashboard?.missionsDone ?? [];
  const state = worldState(bills);
  const items = navItems(t);
  const card = cardId ? (FACTS.find((fact) => fact.id === cardId) ?? null) : null;

  const goToTab = useCallback(
    (id: TabId) => {
      setOverlay(null);
      navigate(TAB_PATHS[id]);
    },
    [navigate],
  );

  const completeMission = useCallback(
    async (id: string) => {
      if (!profile) return;
      await api.data.completeMission(profile.user, id);
      await refresh();
      setOverlay(null);
    },
    [profile, refresh],
  );

  const openShare = useCallback((kwh: number) => {
    setShareKwh(kwh);
    setOverlay("share");
  }, []);

  const openFromProfile = useCallback(
    (next: Overlay) => {
      setProfileOpen(false);
      if (next === "learn" || next === "clip") setCardId(null);
      setOverlay(next);
    },
    [],
  );

  const toggleWifi = useCallback(
    (value: boolean) => {
      void saveSettings({ ...settings, wifiOnly: value });
    },
    [saveSettings, settings],
  );

  const toggleSavedNote = useCallback(
    (id: string) => {
      const savedNotes = settings.savedNotes.includes(id)
        ? settings.savedNotes.filter((note) => note !== id)
        : [...settings.savedNotes, id];
      void saveSettings({ ...settings, savedNotes });
    },
    [saveSettings, settings],
  );

  const saveNest = useCallback(
    async (answers: Pick<SetupAnswers, "homeType" | "people" | "city" | "appliances">) => {
      if (!profile) return;
      await saveProfile({ ...profile, answers: { ...profile.answers, ...answers } });
      setOverlay(null);
    },
    [profile, saveProfile],
  );

  const initials = (profile?.user.displayName ?? "S")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const home = dashError ? (
    <TabError onRetry={() => void refresh()} />
  ) : !dashboard ? (
    <TabLoading label={t("app.tabsHome")} />
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
        setMissionId("standby_sweep");
        setSweepStartComplete(true);
        setOverlay("sweep");
      }}
      onResult={() => setOverlay("result")}
    />
  );

  const tabBody = (() => {
    if (tab === "home") return home;
    if (dashError) return <TabError onRetry={() => void refresh()} />;
    if (!dashboard) return <TabLoading label={t(`app.tabs${tab === "missions" ? "Missions" : tab === "learn" ? "Learn" : "Me"}`)} />;
    if (tab === "missions") {
      return (
        <MissionsTab
          missionsDone={missionsDone}
          onStartSweep={() => {
            setSweepStartComplete(false);
            setOverlay("sweep");
          }}
          onOpenMission={(id) => {
            setMissionId(id);
            setOverlay("mission");
          }}
        />
      );
    }
    if (tab === "learn") {
      return (
        <LearnTab
          facts={FACTS}
          savedNotes={settings.savedNotes}
          onOpen={(id) => {
            setCardId(id);
            setOverlay("learn");
          }}
          onWatch={(id) => {
            setCardId(id);
            setOverlay("clip");
          }}
        />
      );
    }
    if (tab === "community") {
      return <CommunityTab demo={demo} onSignUp={() => {
        clearDemo();
        resetApi();
        navigate("/login", { replace: true, state: { mode: "signup" } });
      }} />;
    }
    if (tab === "me") {
      return (
        <MeTab
          bills={bills}
          demo={demo}
          profile={profile}
          onShare={() => openShare(verifiedTotals(bills).kwh)}
          onOpenProfile={() => setProfileOpen(true)}
          onAddAmount={() => setOverlay("bill")}
        />
      );
    }
    return (
      <div className="page">
        <div className="empty-state">
          <Icon name="sun" size={40} />
          <div>
            <strong>{t("app.runBSolar")}</strong>
            <span>{t("app.runBPlaceholder")}</span>
          </div>
        </div>
      </div>
    );
  })();

  const exitDemo = () => {
    clearDemo();
    resetApi();
    navigate("/welcome", { replace: true });
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
              onClick={() => goToTab(item.id)}
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

        {demo ? (
          <div className="demo-banner" role="status">
            <strong>{t("demo.banner")}</strong>
            <span>
              <button type="button" onClick={() => {
                clearDemo();
                resetApi();
                navigate("/login", { replace: true, state: { mode: "signup" } });
              }}>{t("demo.createNest")}</button>
              <button type="button" onClick={exitDemo}>{t("demo.exit")}</button>
            </span>
          </div>
        ) : null}

        {tabBody}
      </main>

      <nav className="bottom-nav" data-app-tabbar aria-label={t("app.nestName")}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => goToTab(item.id)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <SheetPortalContext.Provider value={frameEl}>
        <ProfileSheet
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          wifiOnly={settings.wifiOnly}
          onToggleWifi={toggleWifi}
          onNest={() => openFromProfile("nest")}
          onBills={() => openFromProfile("bills")}
          onStory={() => {
            setProfileOpen(false);
            navigate("/app/story");
          }}
          onDelete={() => openFromProfile("delete")}
          onSignOut={() => openFromProfile("signout")}
          demo={demo}
        />

        <SweepSheet
          open={overlay === "sweep"}
          onClose={() => setOverlay(null)}
          startComplete={sweepStartComplete}
          onDone={() => completeMission("standby_sweep")}
        />

        <MissionDetailSheet
          open={overlay === "mission" && missionId !== null}
          missionId={missionId ?? "standby_sweep"}
          done={missionId !== null && missionsDone.includes(missionId)}
          onDone={() => void completeMission(missionId ?? "standby_sweep")}
          onClose={() => setOverlay(null)}
        />

        <LearnDetailSheet
          open={overlay === "learn"}
          card={card}
          saved={cardId !== null && settings.savedNotes.includes(cardId)}
          onSave={() => cardId && toggleSavedNote(cardId)}
          onWatch={() => setOverlay("clip")}
          onClose={() => setOverlay(null)}
        />

        <ClipSheet
          open={overlay === "clip"}
          card={card}
          clipUrl={LEARN_CLIP_URL}
          wifiOnly={settings.wifiOnly}
          onClose={() => setOverlay(null)}
        />

        <NestSheet
          open={overlay === "nest"}
          profile={profile}
          onSave={saveNest}
          onClose={() => setOverlay(null)}
        />

        <BillsSheet
          open={overlay === "bills"}
          bills={bills}
          demo={demo}
          error={dashError}
          onRetry={() => void refresh()}
          onAdd={() => setOverlay("bill")}
          onShare={openShare}
          onClose={() => setOverlay(null)}
        />

        <ConfirmSheet
          open={overlay === "delete" || overlay === "signout"}
          kind={overlay === "delete" ? (demo ? "reset" : "delete") : "signout"}
          onBack={() => setOverlay(null)}
          onConfirm={() => {
            if (overlay === "delete" && demo) {
              void resetDemo();
              setOverlay(null);
            } else if (overlay === "delete") {
              void (async () => {
                const result = await deleteAccount();
                navigate("/removed", { replace: true, state: { accountFailed: result === "accountFailed" } });
              })();
            } else {
              void (async () => {
                if (demo) exitDemo();
                else {
                  await signOut();
                  navigate("/login", { replace: true });
                }
              })();
            }
          }}
        />

        <BillSheet
          open={overlay === "bill"}
          onClose={() => setOverlay(null)}
          demo={demo}
          wifiOnly={settings.wifiOnly}
          bills={bills}
          onSaved={refresh}
          onShare={openShare}
        />

        <ResultSheet
          open={overlay === "result"}
          onClose={() => setOverlay(null)}
          bills={bills}
          demo={demo}
          onShare={openShare}
          onAddAmount={() => setOverlay("bill")}
        />

        <ShareSheet
          open={overlay === "share"}
          onClose={() => setOverlay(null)}
          kwh={shareKwh}
          demo={demo}
          baselineUnits={bills[1]?.units ?? null}
          baselineAmount={bills[1]?.amount ?? null}
          onAddBill={() => setOverlay("bill")}
        />
      </SheetPortalContext.Provider>
    </div>
  );
}
