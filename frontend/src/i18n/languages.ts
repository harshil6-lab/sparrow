export type AppLanguage = "en" | "hi" | "gu" | "mr" | "bn" | "ta" | "te" | "kn" | "ml" | "pa";

export type FontModule = "devanagari" | "gujarati" | "bengali" | "tamil" | "telugu" | "kannada" | "malayalam" | "gurmukhi";

export interface LanguageMeta {
  code: AppLanguage;
  native: string;
  english: string;
  /** Only `reviewed` languages have a human-checked translation; the rest fall back to English with a beta tag. */
  reviewed: boolean;
  /** Per-script Noto font module to load when this language is active (null = Latin only). */
  font: FontModule | null;
}

/** The ten languages, listed in their own script. Order matches the design source. */
export const LANGUAGES: LanguageMeta[] = [
  { code: "en", native: "English", english: "English", reviewed: true, font: null },
  { code: "hi", native: "हिन्दी", english: "Hindi", reviewed: true, font: "devanagari" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", reviewed: false, font: "gujarati" },
  { code: "mr", native: "मराठी", english: "Marathi", reviewed: false, font: "devanagari" },
  { code: "bn", native: "বাংলা", english: "Bengali", reviewed: false, font: "bengali" },
  { code: "ta", native: "தமிழ்", english: "Tamil", reviewed: false, font: "tamil" },
  { code: "te", native: "తెలుగు", english: "Telugu", reviewed: false, font: "telugu" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", reviewed: false, font: "kannada" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", reviewed: false, font: "malayalam" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", reviewed: false, font: "gurmukhi" },
];

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return !!value && LANGUAGES.some((l) => l.code === value);
}

export function languageMeta(code: AppLanguage): LanguageMeta {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
