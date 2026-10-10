import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { SparrowLogo } from "../components/SparrowLogo";
import { Icon } from "../components/Icon";
import { WelcomeScene } from "../components/scenes/Scenes";
import { notifyDemoStarted, seedDemo } from "../lib/demo";
import { resetApi } from "../lib/api";

export function WelcomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  /**
   * Demo leaves the real stack behind: resetApi() swaps in the local mock
   * providers (see src/lib/api/index.ts) so a demo session, even in a
   * real-mode build, is fully local and makes zero network calls.
   */
  const startDemo = () => {
    seedDemo();
    resetApi();
    notifyDemoStarted();
    navigate("/app", { replace: true });
  };
  return (
    <main className="landing">
      <header>
        <SparrowLogo />
        <Button
          variant="quiet"
          size="sm"
          icon="arrow"
          iconSize={18}
          onClick={() => navigate("/login")}
        >
          {t("welcome.navExplore")}
        </Button>
      </header>
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Icon name="leaf" size={17} /> {t("welcome.eyebrow")}
          </div>
          <h1>
            {t("welcome.title")}
            <br />
            <em>{t("welcome.titleAccent")}</em>
          </h1>
          <p>{t("welcome.subtitle")}</p>
          <Button icon="arrow" onClick={() => navigate("/login")}>
            {t("welcome.build")}
          </Button>
          <Button variant="quiet" onClick={startDemo}>
            {t("welcome.trySample")}
          </Button>
        </div>
        <WelcomeScene />
      </section>
      <section className="how">
        <div><span>01 · LEARN</span><h2>{t("welcome.howLearn")}</h2></div>
        <div><span>02 · TRY</span><h2>{t("welcome.howTry")}</h2></div>
        <div><span>03 · PROVE</span><h2>{t("welcome.howProve")}</h2></div>
      </section>
    </main>
  );
}
