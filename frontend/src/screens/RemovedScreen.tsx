import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SparrowMascot } from "../components/SparrowMascot";

/**
 * "Nest removed" screen, shown after Delete my data. Markup and copy are reused
 * from the Figma export's removed state; every string is an i18n key.
 */
export function RemovedScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const accountFailed = Boolean((location.state as { accountFailed?: boolean } | null)?.accountFailed);

  return (
    <main className="removed-screen">
      <SparrowMascot pose="curious" size={130} />
      <div className="eyebrow">{t(accountFailed ? "removed.failedEyebrow" : "removed.eyebrow")}</div>
      <h1>{t(accountFailed ? "removed.failedTitle" : "removed.title")}</h1>
      <p>{t(accountFailed ? "removed.failedCopy" : "removed.copy")}</p>
      <button className="primary-button" type="button" onClick={() => navigate("/", { replace: true })}>
        {t("removed.cta")}
      </button>
    </main>
  );
}
