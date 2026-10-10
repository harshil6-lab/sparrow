import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";

/** Loading state shared by Missions, Learn, Bills and Me. */
export function TabLoading({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div className="page">
      <div className="loading-state">
        <span className="spinner" />
        <h2>{label}</h2>
        <p>{t("app.loadingHint")}</p>
      </div>
    </div>
  );
}

/** Error state shared by Missions, Learn and Me: say sorry, offer a retry. */
export function TabError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="page">
      <div className="list-state">
        <Icon name="bill" size={34} />
        <strong>{t("app.loadError")}</strong>
        <p>{t("app.loadErrorHint")}</p>
        <button className="quiet-button" onClick={onRetry}>
          {t("app.retry")}
        </button>
      </div>
    </div>
  );
}

/** Per-tab empty state (no missions, no notes yet). */
export function TabEmpty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="page">
      <div className="empty-state">
        <SparrowMascot pose="curious" size={70} />
        <div>
          <strong>{title}</strong>
          <span>{copy}</span>
        </div>
      </div>
    </div>
  );
}
