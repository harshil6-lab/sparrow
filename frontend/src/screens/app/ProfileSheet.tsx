import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "../../components/ui/Sheet";
import { LanguageList } from "../../components/ui/LanguageList";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../lib/AuthProvider";
import { useLanguage } from "../../lib/LanguageProvider";

/**
 * Profile & settings, opened from every tab's avatar and the Me gear.
 * Rows and their icons come from the Figma export's ProfileMenu: My Nest,
 * Language, Watch the story again, Bills, Reminders, the Wi-Fi toggle, Delete
 * my data and Sign out. Every row opens a working screen or sheet.
 */
export function ProfileSheet({
  open,
  onClose,
  wifiOnly,
  onToggleWifi,
  onNest,
  onBills,
  onReminders,
  onStory,
  onDelete,
  onSignOut,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  wifiOnly: boolean;
  onToggleWifi: (value: boolean) => void;
  onNest: () => void;
  onBills: () => void;
  onReminders: () => void;
  onStory: () => void;
  onDelete: () => void;
  onSignOut: () => void;
  demo: boolean;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { language, setLanguage, isBeta } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);

  const answers = profile?.answers;
  const homeKey =
    answers?.homeType === "independent"
      ? "setup.homeIndependent"
      : answers?.homeType === "row"
        ? "setup.homeRow"
        : answers?.homeType === "apartment"
          ? "setup.homeApartment"
          : null;
  const nestCopy = [answers?.city, homeKey ? t(homeKey) : null, answers?.people]
    .filter(Boolean)
    .join(" \u00b7 ");

  const rows: { key: string; icon: Parameters<typeof Icon>[0]["name"]; label: string; copy: string; action: () => void }[] = [
    {
      key: "nest",
      icon: "home",
      label: t("profile.rowNest"),
      copy: nestCopy || t("profile.rowNestCopy"),
      action: onNest,
    },
    {
      key: "language",
      icon: "language",
      label: t("profile.rowLanguage"),
      copy: `${language.toUpperCase()}${isBeta ? ` \u00b7 ${t("common.betaTag")}` : ""}`,
      action: () => setLangOpen(true),
    },
    {
      key: "story",
      icon: "book",
      label: t("profile.rowStory"),
      copy: t("profile.rowStoryCopy"),
      action: onStory,
    },
    {
      key: "bills",
      icon: "bill",
      label: t("profile.rowBills"),
      copy: t("profile.rowBillsCopy"),
      action: onBills,
    },
    {
      key: "reminders",
      icon: "bell",
      label: t("profile.rowReminders"),
      copy: t("profile.rowRemindersCopy"),
      action: onReminders,
    },
  ];

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        label={t("profile.title")}
        sheetClassName="settings-sheet"
        closeLabel={t("profile.close")}
      >
        <div className="sheet-head">
          <div>
            <span>{profile?.user.displayName ?? t("app.nestName")}</span>
            <h2>{t("profile.title")}</h2>
          </div>
        </div>
        {rows.map((row) => (
          <button key={row.key} type="button" aria-label={row.label} onClick={row.action}>
            <Icon name={row.icon} />
            <span>
              <strong>{row.label}</strong>
              <small>{row.copy}</small>
            </span>
            <Icon name="arrow" />
          </button>
        ))}
        <button type="button" aria-pressed={wifiOnly} onClick={() => onToggleWifi(!wifiOnly)}>
          <Icon name="wifi" />
          <span>
            <strong>{t("profile.rowWifi")}</strong>
            <small>{t("profile.rowWifiCopy")}</small>
          </span>
          <span className={`toggle ${wifiOnly ? "on" : ""}`} aria-hidden="true">
            <i />
          </span>
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          <Icon name="trash" />
          <span>
            <strong>{t(demo ? "profile.rowReset" : "profile.rowDelete")}</strong>
              <small>{t(demo ? "profile.rowResetCopy" : "profile.rowDeleteCopy")}</small>
          </span>
          <Icon name="arrow" />
        </button>
        <button type="button" onClick={onSignOut}>
          <Icon name="logout" />
          <span>
            <strong>{t(demo ? "profile.rowExitDemo" : "profile.rowSignOut")}</strong>
            <small>{demo ? t("profile.rowExitDemoCopy") : profile?.user.email ?? t("profile.rowSignOutCopy")}</small>
          </span>
          <Icon name="arrow" />
        </button>
      </Sheet>
      <LanguageList open={langOpen} value={language} onChange={setLanguage} onClose={() => setLangOpen(false)} />
    </>
  );
}