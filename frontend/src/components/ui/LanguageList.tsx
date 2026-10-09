import { useTranslation } from "react-i18next";
import { Sheet } from "./Sheet";
import { Icon } from "../Icon";
import { LANGUAGES, type AppLanguage } from "../../i18n/languages";

interface LanguageListProps {
  open: boolean;
  value: AppLanguage;
  onChange: (code: AppLanguage) => void;
  onClose: () => void;
}

/**
 * Language picker. Ten languages, each listed in its own script.
 * Unreviewed languages carry a small "beta" tag (they fall back to English).
 */
export function LanguageList({ open, value, onChange, onClose }: LanguageListProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("common.languageTitle")}
      sheetClassName="language-sheet"
      closeLabel={t("app.close")}
    >
      <div className="sheet-head">
        <div>
          <span>{t("common.languageSheetLabel")}</span>
          <h2>{t("common.languageTitle")}</h2>
        </div>
      </div>
      <div className="language-list">
        {LANGUAGES.map((lang) => {
          const selected = value === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              className={selected ? "selected" : ""}
              aria-pressed={selected}
              lang={lang.code}
              onClick={() => {
                onChange(lang.code);
                onClose();
              }}
            >
              <span>
                {lang.native}
                {!lang.reviewed && lang.code !== "en" ? (
                  <small className="beta-tag"> {t("common.betaTag")}</small>
                ) : null}
              </span>
              {selected ? <Icon name="check" /> : null}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
