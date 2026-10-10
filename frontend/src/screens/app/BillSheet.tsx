import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sheet } from "../../components/ui/Sheet";
import { api } from "../../lib/api";
import type { Bill } from "../../lib/api/data";
import { useAuth } from "../../lib/AuthProvider";
import { currentMonthKey, parseUnits, validateUnits, type UnitsError } from "../../lib/bills";
import { VerificationResult } from "./VerificationResult";

type Phase = "entry" | "loading" | "done" | "error";
type PhotoState = "idle" | "loading" | "ready" | "error";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bill sheet: entry -> loading -> baseline / verification result, plus an error
 * state. Reuses the export's markup; the units field validates inline (required,
 * number, 1-5000), the month picker defaults to the current month, and the
 * optional photo is stored locally (never parsed).
 */
export function BillSheet({
  open,
  onClose,
  demo,
  previousBill,
  onSaved,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  demo: boolean;
  /** The latest stored bill before this one — null for a first (baseline) bill. */
  previousBill: Bill | null;
  onSaved: () => Promise<void>;
  onShare: (kwh: number) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [units, setUnits] = useState("");
  const [month, setMonth] = useState(() => currentMonthKey());
  const [unitsError, setUnitsError] = useState<UnitsError>(null);
  const [photo, setPhoto] = useState<PhotoState>("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("entry");
  const [saved, setSaved] = useState<Bill | null>(null);
  const [baseline, setBaseline] = useState<Bill | null>(null);

  useEffect(() => {
    if (!open) return;
    setUnits("");
    setMonth(currentMonthKey());
    setUnitsError(null);
    setPhoto("idle");
    setPhotoDataUrl(undefined);
    setPhase("entry");
    setSaved(null);
    setBaseline(null);
  }, [open]);

  const readPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhoto("error");
      return;
    }
    setPhoto("loading");
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(typeof reader.result === "string" ? reader.result : undefined);
      setPhoto("ready");
    };
    reader.onerror = () => setPhoto("error");
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const error = validateUnits(units);
    if (error) {
      setUnitsError(error);
      return;
    }
    const value = parseUnits(units);
    if (!profile || value === null) return;
    const previous = previousBill;
    setBaseline(previous);
    setPhase("loading");
    try {
      await delay(450);
      const bill = await api.data.addBill(profile.user, {
        month,
        units: value,
        ...(photoDataUrl ? { photoDataUrl } : {}),
      });
      setSaved(bill);
      await onSaved();
      setPhase("done");
    } catch {
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
        baseline ? (
          <VerificationResult previous={baseline} bill={saved} demo={demo} onShare={onShare} onClose={onClose} />
        ) : (
          <>
            <SparrowMascot pose="hop" size={110} />
            <div className="eyebrow">{t("bill.baselineEyebrow")}</div>
            <h2>{t("bill.baselineTitle")}</h2>
            <p>{t("bill.baselineCopy")}</p>
            <button className="primary-button wide" onClick={onClose}>
              {t("bill.seeNest")} <Icon name="arrow" size={18} />
            </button>
          </>
        )
      ) : phase === "loading" ? (
        <div className="loading-state">
          <SparrowMascot pose="ruffled" size={100} />
          <span className="spinner" />
          <h2>{t("bill.loadingTitle")}</h2>
          <p>{t("bill.loadingCopy")}</p>
        </div>
      ) : phase === "error" ? (
        <div className="list-state">
          <Icon name="bill" size={34} />
          <strong>{t("bill.saveError")}</strong>
          <p>{t("bill.saveErrorHint")}</p>
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
            {t("bill.monthLabel")}
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label className={`optional-upload upload-${photo}`}>
            <Icon name={photo === "ready" ? "check" : "camera"} />
            <span>
              <strong>
                {photo === "loading"
                  ? t("bill.photoLoading")
                  : photo === "ready"
                    ? t("bill.photoReady")
                    : photo === "error"
                      ? t("bill.photoError")
                      : t("bill.photoAdd")}
              </strong>
              <small>{photo === "error" ? t("bill.photoErrorHint") : t("bill.photoOptional")}</small>
            </span>
            {photo === "loading" ? <span className="spinner small" /> : null}
            <input type="file" accept="image/*" onChange={(event) => readPhoto(event.target.files?.[0])} />
          </label>
          <button className="primary-button wide" onClick={() => void submit()}>
            {t("bill.verify")} <Icon name="arrow" size={18} />
          </button>
        </>
      )}
    </Sheet>
  );
}