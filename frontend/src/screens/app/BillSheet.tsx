import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sheet } from "../../components/ui/Sheet";
import { api } from "../../lib/api";
import type { AddBillResult } from "../../lib/api/data";
import { HttpError, NetworkError } from "../../lib/api/http";
import { useAuth } from "../../lib/AuthProvider";
import {
  currentMonthKey,
  parseAmount,
  parseUnits,
  buildBillPayload,
  validateAmount,
  validateUnits,
  type AmountError,
  type UnitsError,
} from "../../lib/bills";
import { compressBillPhoto } from "../../lib/photos";
import { VerificationResult } from "./VerificationResult";

type Phase = "entry" | "loading" | "photo-error" | "done" | "error";
/**
 * Bill sheet: entry -> loading -> baseline / verification result, plus an error
 * state. Reuses the export's markup; the units field validates inline (required,
 * number, 1-5000), the month picker defaults to the current month. The POST
 * body is deliberately limited to the server bill contract.
 */
export function BillSheet({
  open,
  onClose,
  demo,
  wifiOnly,
  onSaved,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  demo: boolean;
  wifiOnly: boolean;
  onSaved: () => Promise<void>;
  onShare: (kwh: number) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [units, setUnits] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(() => currentMonthKey());
  const [unitsError, setUnitsError] = useState<UnitsError>(null);
  const [amountError, setAmountError] = useState<AmountError>(null);
  const [phase, setPhase] = useState<Phase>("entry");
  const [saved, setSaved] = useState<AddBillResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoProgress, setPhotoProgress] = useState(0);
  const retryPhoto = useRef(false);

  useEffect(() => {
    if (!open) return;
    setUnits("");
    setAmount("");
    setMonth(currentMonthKey());
    setUnitsError(null);
    setAmountError(null);
    setPhase("entry");
    setSaved(null);
    setErrorMessage(null);
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError(null);
    setPhotoProgress(0);
    retryPhoto.current = false;
  }, [open]);

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const compressed = await compressBillPhoto(file);
      setPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      setPhotoError(null);
    } catch (error) {
      setPhotoError(error instanceof Error && error.message === "unsupported photo type"
        ? t("bill.photoTypeError")
        : t("bill.photoSizeError"));
    }
  };

  const submit = async (retry = false) => {
    const error = validateUnits(units);
    const nextAmountError = validateAmount(amount);
    if (error || nextAmountError) {
      setUnitsError(error);
      setAmountError(nextAmountError);
      return;
    }
    const value = parseUnits(units);
    const amountValue = parseAmount(amount);
    if (!profile || value === null) return;
    setPhase("loading");
    setErrorMessage(null);
    try {
      const result = await api.data.addBill(profile.user, {
        ...buildBillPayload(month, value, amountValue),
      });
      setSaved(result);
      await onSaved();
      if (photo && (!retry || retryPhoto.current)) {
        try {
          setPhotoProgress(0);
          await api.data.uploadBillPhoto(profile.user, month, photo, wifiOnly, setPhotoProgress);
          await onSaved();
        } catch (photoUploadError) {
          retryPhoto.current = true;
          setPhotoError(photoUploadError instanceof HttpError && photoUploadError.status === 404
            ? t("bill.photoNotFound")
            : t("bill.photoFailed"));
          setPhase("photo-error");
          return;
        }
      }
      setPhase("done");
    } catch (error) {
      if (import.meta.env.DEV && error instanceof NetworkError) {
        console.error("[sparrow] network error", error);
      }
      if (error instanceof HttpError && error.status === 400) {
        setErrorMessage(t("bill.saveErrorValidation", { details: error.message }));
      } else if (error instanceof HttpError && error.status === 401) {
        setErrorMessage(t("bill.saveErrorSession"));
      } else if (error instanceof HttpError && error.status >= 500) {
        setErrorMessage(t("bill.saveErrorServer"));
      } else if (error instanceof NetworkError) {
        setErrorMessage(t("bill.saveErrorNetwork"));
      } else {
        setErrorMessage(t("bill.saveError"));
      }
      setPhase("error");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("bill.close")}
      sheetClassName="sheet bill-sheet"
      closeLabel={t("bill.close")}
    >
      {phase === "done" && saved ? (
        saved.verification.baseline ? (
          <>
            <SparrowMascot pose="hop" size={110} />
            <div className="eyebrow">{t("bill.baselineEyebrow")}</div>
            <h2>{t("bill.baselineTitle")}</h2>
            <p>{t("bill.baselineCopy")}</p>
            <button className="primary-button wide" onClick={onClose}>
              {t("bill.seeNest")} <Icon name="arrow" size={18} />
            </button>
          </>
        ) : (
          <VerificationResult
            bill={saved.bill}
            verification={saved.verification}
            demo={demo}
            onShare={onShare}
            onClose={onClose}
          />
        )
      ) : phase === "loading" ? (
        <div className="loading-state">
          <SparrowMascot pose="ruffled" size={100} />
          <span className="spinner" />
          <h2>{t("bill.loadingTitle")}</h2>
          <p>{t("bill.loadingCopy")}</p>
        </div>
      ) : phase === "photo-error" && saved ? (
        <div className="list-state">
          <Icon name="bill" size={34} />
          <strong>{t("bill.photoSavedTitle")}</strong>
          <p>{photoError ?? t("bill.photoFailed")}</p>
          {photoProgress > 0 ? <progress max="100" value={photoProgress} aria-label={t("bill.photoProgress")} /> : null}
          <button className="primary-button wide" onClick={() => void submit(true)}>{t("bill.photoRetry")}</button>
          <button className="quiet-button" onClick={() => setPhase("done")}>{t("bill.photoSkip")}</button>
        </div>
      ) : phase === "error" ? (
        <div className="list-state">
          <Icon name="bill" size={34} />
          <strong>{t("bill.saveError")}</strong>
          <p>{errorMessage ?? t("bill.saveErrorHint")}</p>
          <button className="quiet-button" onClick={() => setPhase("entry")}>
            {t("home.retry")}
          </button>
        </div>
      ) : (
        <>
          <div className="sheet-icon">
            <Icon name="bill" size={30} />
          </div>
          <div className="eyebrow">{t("bill.eyebrow")}</div>
          <h2>{t("bill.title")}</h2>
          <label>
            {t("bill.unitsLabel")}
            <input
              className={unitsError ? "error" : ""}
              inputMode="decimal"
              value={units}
              aria-invalid={unitsError ? true : undefined}
              placeholder={t("bill.unitsPlaceholder")}
              onChange={(event) => {
                setUnits(event.target.value);
                setUnitsError(null);
              }}
            />
          </label>
          {unitsError ? (
            <div className="inline-error">
              {unitsError === "required" ? t("bill.errorRequired") : t("bill.errorRange")}
            </div>
          ) : null}
          <label>
            {t("bill.amountLabel")}
            <input
              className={amountError ? "error" : ""}
              inputMode="numeric"
              value={amount}
              aria-invalid={amountError ? true : undefined}
              placeholder={t("bill.amountPlaceholder")}
              onChange={(event) => {
                setAmount(event.target.value);
                setAmountError(null);
              }}
            />
          </label>
          {amountError ? <div className="inline-error">{t("bill.amountErrorRange")}</div> : null}
          <small className="field-hint">{t("bill.amountHint")}</small>
          <label>
            {t("bill.monthLabel")}
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <div className="bill-photo-picker">
            <div className="eyebrow">{t("bill.photoLabel")}</div>
            {photoPreview ? (
              <div>
                <img src={photoPreview} alt={t("bill.photoAlt", { month })} className="bill-photo-thumb" />
                <button type="button" className="text-button" onClick={() => { setPhoto(null); setPhotoPreview(null); }}>
                  {t("bill.photoRemove")}
                </button>
              </div>
            ) : (
              <div className="photo-actions">
                <label className="quiet-button">
                  {t("bill.photoTake")}
                  <input hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => void choosePhoto(e.target.files?.[0])} />
                </label>
                <label className="quiet-button">
                  {t("bill.photoChoose")}
                  <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void choosePhoto(e.target.files?.[0])} />
                </label>
              </div>
            )}
            {photoError ? <div className="inline-error">{photoError}</div> : null}
            <small className="field-hint">{t("bill.photoPrivacy")}</small>
          </div>
          <button className="primary-button wide" onClick={() => void submit()}>
            {t("bill.verify")} <Icon name="arrow" size={18} />
          </button>
        </>
      )}
    </Sheet>
  );
}
