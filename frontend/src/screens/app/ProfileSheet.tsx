import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "../../components/ui/Sheet";
import { LanguageList } from "../../components/ui/LanguageList";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../lib/AuthProvider";
import { useLanguage } from "../../lib/LanguageProvider";

/**
 * Profile sheet, opened from the app header avatar.
 * Includes the language picker (the language pill also lives in Profile).
 * Sign-out is wired to the mock auth provider; Cognito plugs in behind the same call.
 */
export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const { language, setLanguage, isBeta } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        label={t("app.profileTitle")}
        sheetClassName="settings-sheet"
        closeLabel={t("app.close")}
      >
        <div className="sheet-head">
          <div>
            <span>{t("app.profileTitle")}</span>
            <h2>{profile?.user.displayName ?? t("app.nestName")}</h2>
          </div>
        </div>
        <button type="button" onClick={() => setLangOpen(true)}>
          <Icon name="language" />
          <span>
            <strong>{t("common.languageTitle")}</strong>
            <small>
              {language.toUpperCase()}
              {isBeta ? ` · ${t("common.betaTag")}` : ""}
            </small>
          </span>
          <Icon name="arrow" />
        </button>
        <button
          type="button"
          onClick={() => {
            void signOut();
            onClose();
          }}
        >
          <Icon name="logout" />
          <span>
            <strong>Sign out</strong>
            <small>{profile?.user.email ?? ""}</small>
          </span>
          <Icon name="arrow" />
        </button>
      </Sheet>
      <LanguageList open={langOpen} value={language} onChange={setLanguage} onClose={() => setLangOpen(false)} />
    </>
  );
}
