import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sample } from "../../components/ui/Sample";
import { SourceSheet } from "../../components/ui/SourceSheet";
import type { Bill, Verification } from "../../lib/api/data";
import {
  co2Kg,
  formatCo2KgForDisplay,
  formatKwhForDisplay,
  formatRupeesForDisplay,
  missionResult,
  rupeesSaved,
} from "../../lib/impact";
import { emissionFactor, hasEmissionFactor } from "../../lib/config";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthProvider";
import { HttpError } from "../../lib/api/http";
import { Sheet } from "../../components/ui/Sheet";

/**
 * The verification result, shared by the bill sheet (second or later bill) and
 * the Home "View result" sheet. Uses the same math as backend/impact.py.
 *
 * CO2 = kWh saved x the cited grid factor. Rupees = kWh saved x the user's OWN
 * average rate from the baseline bill. When the baseline bill has no amount the
 * rupee figure stays hidden and the user is offered the bill sheet instead.
 */
export function VerificationResult({
  previous,
  bill,
  verification,
  demo,
  onShare,
  onClose,
  onAddAmount,
}: {
  /** The previous bill, for the local fallback when no server result is given. */
  previous?: Bill | null;
  bill: Bill;
  /** Server-computed verification (POST /bills). Preferred over recomputing. */
  verification?: Verification | null;
  demo: boolean;
  onShare: (kwh: number) => void;
  onClose: () => void;
  /** Opens the bill sheet so the baseline amount can be added. Optional. */
  onAddAmount?: () => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(bill.photoUrl ?? null);
  const [photoLoading, setPhotoLoading] = useState(Boolean(bill.hasPhoto));
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  useEffect(() => {
    if (!bill.hasPhoto || !profile) {
      setPhotoLoading(false);
      return;
    }
    let active = true;
    void api.data.getBillPhoto(profile.user, bill.month).then((url) => {
      if (active) setPhotoUrl(url);
    }).catch((error) => {
      if (active && !(error instanceof HttpError && error.status === 404)) setPhotoError(true);
    }).finally(() => {
      if (active) setPhotoLoading(false);
    });
    return () => { active = false; };
  }, [bill.hasPhoto, bill.month, profile]);

  const photo = bill.hasPhoto ? (
    <div className="bill-photo-result">
      {photoLoading ? <span className="photo-skeleton" aria-label={t("bill.photoLoading")} /> : null}
      {photoUrl && !photoError ? (
        <>
          <img src={photoUrl} alt={t("bill.photoAlt", { month: bill.month })} className="bill-photo-thumb" />
          <button type="button" className="text-button" onClick={() => setPhotoOpen(true)}>{t("bill.photoView")}</button>
          <button type="button" className="text-button" onClick={() => {
            if (!profile || !window.confirm(t("bill.photoRemoveConfirm"))) return;
            void api.data.deleteBillPhoto(profile.user, bill.month).then(() => setPhotoUrl(null));
          }}>{t("bill.photoRemove")}</button>
          <Sheet open={photoOpen} onClose={() => setPhotoOpen(false)} label={t("bill.photoView")} closeLabel={t("common.close")}>
            <img src={photoUrl} alt={t("bill.photoAlt", { month: bill.month })} className="bill-photo-full" />
          </Sheet>
        </>
      ) : null}
      {photoError ? <small>{t("bill.photoLoadError")}</small> : null}
    </div>
  ) : null;
  // The server result wins when present: it is the source of truth. A missing
  // co2_kg / rupees_saved in the response means the figure stays hidden.
  const server = verification && !verification.baseline ? verification : null;
  const result = server
    ? {
        kwhSaved: server.kwh_saved ?? 0,
        dropPct: server.drop_pct ?? 0,
        verified: Boolean(server.verified),
      }
    : previous
      ? missionResult(previous.units, bill.units)
      : { kwhSaved: 0, dropPct: 0, verified: bill.verified };
  const factor = emissionFactor();
  const co2 = server
    ? typeof server.co2_kg === "number"
      ? server.co2_kg
      : null
    : hasEmissionFactor && factor !== null
      ? co2Kg(result.kwhSaved, factor)
      : null;
  const rupees = server
    ? typeof server.rupees_saved === "number"
      ? server.rupees_saved
      : null
    : previous
      ? rupeesSaved(result.kwhSaved, previous.amount ?? null, previous.units)
      : null;
  const kwhText = formatKwhForDisplay(result.kwhSaved);

  const co2Figure =
    co2 !== null ? (
      <span className="source-figure">
        {demo ? <Sample /> : null}
        <span>{t("common.co2Figure", { kg: formatCo2KgForDisplay(co2) })}</span>
        <button type="button" className="source-button" onClick={() => setSourceOpen(true)}>
          {t("common.source")}
        </button>
      </span>
    ) : (
      <span>{t("common.sourcePending")}</span>
    );

  const rupeeFigure =
    rupees !== null ? (
      <span className="source-figure">
        {demo ? <Sample /> : null}
        <span>{t("common.rupeesFigure", { amount: formatRupeesForDisplay(rupees) })}</span>
        <span className="figure-note">{t("common.atYourRate")}</span>
      </span>
    ) : onAddAmount ? (
      <button type="button" className="text-button" onClick={onAddAmount}>
        {t("common.addAmount")}
      </button>
    ) : (
      <span>{t("common.addAmount")}</span>
    );

  const figures = (
    <div className="detail-facts">
      <div>
        <Icon name="leaf" />
        <span>
          <strong>{t("bill.co2Label")}</strong>
          <small>{co2Figure}</small>
        </span>
      </div>
      <div>
        <Icon name="coin1" />
        <span>
          <strong>{t("bill.moneyLabel")}</strong>
          <small>{rupeeFigure}</small>
        </span>
      </div>
    </div>
  );

  const sourceSheet = <SourceSheet open={sourceOpen} onClose={() => setSourceOpen(false)} />;

  if (result.verified) {
    return (
      <>
        <SparrowMascot pose="celebrate" size={110} />
        <div className="eyebrow">{t("bill.resultEyebrow")}</div>
        <h2>{t("bill.resultTitle", { kwh: kwhText })}</h2>
        {demo ? <Sample /> : null}
        <p>{t("bill.resultCopy")}</p>
        {photo}
        {figures}
        <div className="result-actions">
          <button className="primary-button" onClick={() => onShare(result.kwhSaved)}>
            <Icon name="share" size={18} /> {t("bill.share")}
          </button>
          <button className="quiet-button" onClick={onClose}>
            {t("bill.seeUpdatedNest")}
          </button>
        </div>
        {sourceSheet}
      </>
    );
  }

  return (
    <>
      <SparrowMascot pose="curious" size={110} />
      <div className="eyebrow">{t("bill.noChangeEyebrow")}</div>
      <h2>{t("bill.noChangeTitle")}</h2>
      <p>{t("bill.noChangeCopy")}</p>
      {photo}
      {figures}
      <div className="result-actions">
        <button className="quiet-button" onClick={onClose}>
          {t("bill.seeUpdatedNest")}
        </button>
      </div>
      {sourceSheet}
    </>
  );
}
