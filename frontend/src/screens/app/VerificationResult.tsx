import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sample } from "../../components/ui/Sample";
import type { Bill } from "../../lib/api/data";
import { co2Kg, missionResult } from "../../lib/impact";
import { emissionFactor, hasEmissionFactor } from "../../lib/config";

function formatKg(value: number): string {
  return `${Math.round(value * 10) / 10} kg`;
}

/**
 * The verification result, shared by the bill sheet (second or later bill) and
 * the Home "View result" sheet. Uses the same math as backend/impact.py.
 *
 * CO2 and rupee figures are hidden and replaced with "source pending" while
 * data/config.json has no cited factor / tariff.
 */
export function VerificationResult({
  previous,
  bill,
  demo,
  onShare,
  onClose,
}: {
  previous: Bill;
  bill: Bill;
  demo: boolean;
  onShare: (kwh: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const result = missionResult(previous.units, bill.units);
  const factor = emissionFactor();
  const co2 = hasEmissionFactor && factor !== null ? formatKg(co2Kg(result.kwhSaved, factor)) : null;

  const figures = (
    <div className="detail-facts">
      <div>
        <Icon name="leaf" />
        <span>
          <strong>{t("bill.co2Label")}</strong>
          <small>{co2 ?? t("common.sourcePending")}</small>
        </span>
      </div>
      <div>
        <Icon name="coin1" />
        <span>
          <strong>{t("bill.moneyLabel")}</strong>
          {/* Rupee savings need a sourced tariff schedule; tariff_slabs is null. */}
          <small>{t("common.sourcePending")}</small>
        </span>
      </div>
    </div>
  );

  if (result.verified) {
    return (
      <>
        <SparrowMascot pose="celebrate" size={110} />
        <div className="eyebrow">{t("bill.resultEyebrow")}</div>
        <h2>{t("bill.resultTitle", { kwh: result.kwhSaved })}</h2>
        {demo ? <Sample /> : null}
        <p>{t("bill.resultCopy")}</p>
        {figures}
        <div className="result-actions">
          <button className="primary-button" onClick={() => onShare(result.kwhSaved)}>
            <Icon name="share" size={18} /> {t("bill.share")}
          </button>
          <button className="quiet-button" onClick={onClose}>
            {t("bill.seeUpdatedNest")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <SparrowMascot pose="curious" size={110} />
      <div className="eyebrow">{t("bill.noChangeEyebrow")}</div>
      <h2>{t("bill.noChangeTitle")}</h2>
      <p>{t("bill.noChangeCopy")}</p>
      {figures}
      <div className="result-actions">
        <button className="quiet-button" onClick={onClose}>
          {t("bill.seeUpdatedNest")}
        </button>
      </div>
    </>
  );
}