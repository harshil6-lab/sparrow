import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { LanguageButton } from "../components/ui/LanguageButton";
import { LanguageList } from "../components/ui/LanguageList";
import { SplashScene } from "../components/scenes/Scenes";
import { useLanguage } from "../lib/LanguageProvider";
import { useAuth } from "../lib/AuthProvider";
import { nextRoute } from "../lib/types";
import { languageMeta } from "../i18n/languages";

/**
 * Splash: falling-leaves animation, the sparrow glides in and lands on the wire,
 * the wordmark and tagline fade up, then the "Enter Sparrow" pill and the
 * language pill. All motion is transform/opacity only; prefers-reduced-motion
 * turns it into the static layout (handled in the stylesheet).
 *
 * "Enter Sparrow" continues to the user's gate: the app for a returning user,
 * the story/setup flow otherwise.
 */
export function SplashScreen() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { ready, profile } = useAuth();
  const [picker, setPicker] = useState(false);
  const navigate = useNavigate();

  const enter = () => {
    if (ready && profile) {
      navigate(nextRoute(profile), { replace: true });
      return;
    }
    navigate("/welcome");
  };

  return (
    <main className="splash">
      <SplashScene />
      <div className="splash-wordmark">{t("splash.wordmark")}</div>
      <p>{t("splash.tagline")}</p>
      <Button variant="sun" className="splash-enter" icon="arrow" onClick={enter}>
        {t("splash.enter")}
      </Button>
      <LanguageButton native={languageMeta(language).native} onClick={() => setPicker(true)} light />
      <LanguageList open={picker} value={language} onChange={setLanguage} onClose={() => setPicker(false)} />
    </main>
  );
}


