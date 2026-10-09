import { useEffect } from "react";
import { LANGUAGES, type AppLanguage, type FontModule } from "./languages";

/**
 * Self-hosted @fontsource bundles, one per script.
 * The shared Latin body font is imported once in main.tsx.
 * Per-script fonts are code-split and only fetched for the active language.
 */
const LOADERS: Record<FontModule, () => Promise<unknown>> = {
  devanagari: () => import("@fontsource/noto-sans-devanagari"),
  gujarati: () => import("@fontsource/noto-sans-gujarati"),
  bengali: () => import("@fontsource/noto-sans-bengali"),
  tamil: () => import("@fontsource/noto-sans-tamil"),
  telugu: () => import("@fontsource/noto-sans-telugu"),
  kannada: () => import("@fontsource/noto-sans-kannada"),
  malayalam: () => import("@fontsource/noto-sans-malayalam"),
  gurmukhi: () => import("@fontsource/noto-sans-gurmukhi"),
};

const loaded = new Set<FontModule>();

/** Loads the Noto font for the active language only. English needs no extra font. */
export function useLanguageFont(code: AppLanguage): void {
  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === code);
    const font = meta?.font;
    if (!font || loaded.has(font)) return;
    loaded.add(font);
    void LOADERS[font]().catch(() => {
      loaded.delete(font);
    });
  }, [code]);
}
