import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sheet } from "../../components/ui/Sheet";

/**
 * Standby sweep sheet ("I found one"). Reused from the Figma export.
 * Finding three devices records a completed mission — it never changes the
 * world state (that comes only from verified bills).
 */
export function SweepSheet({
  open,
  onClose,
  startComplete,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** Open straight into the mission-complete view (from the completed card). */
  startComplete: boolean;
  onDone: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [found, setFound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFound(startComplete ? 3 : 0);
    setBusy(false);
    setError(false);
  }, [open, startComplete]);

  const complete = found >= 3;

  const finish = async () => {
    setBusy(true);
    setError(false);
    try {
      await onDone();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("sweep.close")}
      sheetClassName="sheet sweep-sheet"
      closeLabel={t("sweep.close")}
    >
      {!complete ? (
        <>
          <SparrowMascot pose={found === 2 ? "hop" : "curious"} size={86} />
          <div className="eyebrow">{t("sweep.eyebrow", { n: found })}</div>
          <h2>{found === 0 ? t("sweep.title0") : found === 1 ? t("sweep.title1") : t("sweep.title2")}</h2>
          <p>{t("sweep.copy")}</p>
          <div className="device-scene">
            <div className="device-tv">
              <i className={found > 0 ? "off" : ""} />
            </div>
            <div className="device-router">
              <i className={found > 1 ? "off" : ""} />
            </div>
            <div className="device-charger">
              <i />
            </div>
          </div>
          <button className="primary-button wide" onClick={() => setFound((n) => Math.min(3, n + 1))}>
            {t("sweep.found")} <Icon name="check" size={18} />
          </button>
        </>
      ) : (
        <>
          <SparrowMascot pose="celebrate" size={110} />
          <div className="eyebrow">{t("sweep.completeEyebrow")}</div>
          <h2>{t("sweep.completeTitle")}</h2>
          <p>{t("sweep.completeCopy")}</p>
          <small className="complete-line">
            <Icon name="leaf" size={18} /> {t("home.card2Recorded")}
          </small>
          {error ? <div className="inline-error">{t("sweep.saveError")}</div> : null}
          <button className="primary-button wide" disabled={busy} onClick={() => void finish()}>
            {t("sweep.back")} <Icon name="arrow" size={18} />
          </button>
        </>
      )}
    </Sheet>
  );
}