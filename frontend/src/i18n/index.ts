import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import { DEFAULT_LANGUAGE, LANGUAGES, type AppLanguage } from "./languages";

/** Only languages with a real translation bundle ship resources. */
const resources = {
  en: { translation: en },
  hi: { translation: hi },
} as const;

const STORAGE_KEY = "sparrow-language";

export function readStoredLanguage(): AppLanguage {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && LANGUAGES.some((l) => l.code === value)) return value as AppLanguage;
  } catch {
    /* localStorage unavailable (private mode / SSR) — fall through */
  }
  return DEFAULT_LANGUAGE;
}

export function persistLanguage(code: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

/**
 * Unreviewed languages deliberately have no bundle: i18next falls back to English
 * for every key, which is the "beta" behaviour required by the brief.
 */
void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map((l) => l.code),
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
