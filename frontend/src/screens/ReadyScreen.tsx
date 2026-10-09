import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/Icon";
import { ReadyScene } from "../components/scenes/Scenes";

export function ReadyScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <main className="ready-screen">
      <ReadyScene />
      <section>
        <div className="eyebrow">
          <Icon name="check" size={17} /> {t("ready.eyebrow")}
        </div>
        <h1>{t("ready.title")}</h1>
        <p>{t("ready.subtitle")}</p>
        <Button icon="arrow" onClick={() => navigate("/app", { replace: true })}>
          {t("ready.cta")}
        </Button>
      </section>
    </main>
  );
}

