import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import i18n, { persistLanguage, readStoredLanguage } from "../i18n";
import { useLanguageFont } from "../i18n/useLanguageFont";
import { languageMeta, type AppLanguage } from "../i18n/languages";

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (code: AppLanguage) => void;
  /** True when the active language has no reviewed translation and shows English + a beta tag. */
  isBeta: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const stored = readStoredLanguage();
    if (i18n.language !== stored) void i18n.changeLanguage(stored);
    return stored;
  });

  useLanguageFont(language);

  const setLanguage = useCallback((code: AppLanguage) => {
    setLanguageState(code);
    persistLanguage(code);
    void i18n.changeLanguage(code);
  }, []);

  useEffect(() => {
    const onChange = (lng: string) => {
      const meta = languageMeta(lng as AppLanguage);
      setLanguageState(meta.code);
    };
    i18n.on("languageChanged", onChange);
    return () => i18n.off("languageChanged", onChange);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, isBeta: !languageMeta(language).reviewed }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within <LanguageProvider>");
  return ctx;
}
