import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowLogo } from "../../components/SparrowLogo";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sample } from "../../components/ui/Sample";
import { Sheet } from "../../components/ui/Sheet";
import { SourceSheet } from "../../components/ui/SourceSheet";
import { useAuth } from "../../lib/AuthProvider";
import {
  co2Kg,
  formatCo2KgForDisplay,
  formatRupeesForDisplay,
  rupeesSaved,
} from "../../lib/impact";
import { emissionFactor, hasEmissionFactor } from "../../lib/config";

type Status = "idle" | "shared" | "copied" | "error";

function formatKwh(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * "Share my impact" card, reused from the Figma export. Shows only the user's
 * own verified numbers (SAMPLE-badged in demo mode). Uses the Web Share API
 * when available, otherwise copies a link to the clipboard.
 */
export function ShareSheet({
  open,
  onClose,
  kwh,
  demo,
  baselineUnits,
  baselineAmount,
  onAddBill,
}: {
  open: boolean;
  onClose: () => void;
  kwh: number;
  demo: boolean;
  /** Baseline bill, for the user's own rupee rate. Null when there is none. */
  baselineUnits: number | null;
  baselineAmount: number | null;
  /** Opens the bill sheet so the baseline amount can be added. */
  onAddBill: () => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [sourceOpen, setSourceOpen] = useState(false);

  useEffect(() => {
    if (open) setStatus("idle");
  }, [open]);

  const name = (profile?.user.displayName ?? "S").split(" ")[0].toUpperCase();
  const figure = formatKwh(kwh);
  const factor = emissionFactor();
  const co2 = hasEmissionFactor && factor !== null ? co2Kg(kwh, factor) : null;
  const rupees = rupeesSaved(kwh, baselineAmount, baselineUnits ?? 0);

  const share = async () => {
    const text = t("share.shareText", { kwh: figure });
    const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { share?: (data: ShareData) => Promise<void> });
    try {
      if (nav?.share) {
        await nav.share({ title: t("share.shareTitle"), text });
        setStatus("shared");
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        const url = typeof window !== "undefined" ? window.location.origin : "";
        await navigator.clipboard.writeText(`${text} ${url}`.trim());
        setStatus("copied");
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("share.close")}
      sheetClassName="share-sheet"
      closeLabel={t("share.close")}
    >
      <div className="share-card">
        <SparrowLogo light />
        <SparrowMascot pose="celebrate" size={100} />
        <span>{t("share.kicker", { name })}</span>
        <h2>{t("share.kwh", { kwh: figure })}</h2>
        {demo ? <Sample /> : null}
        <div className="share-figures">
          {co2 !== null ? (
            <span className="source-figure">
              {demo ? <Sample /> : null}
              <span>{t("common.co2Figure", { kg: formatCo2KgForDisplay(co2) })}</span>
              <button type="button" className="source-button" onClick={() => setSourceOpen(true)}>
                {t("common.source")}
              </button>
            </span>
          ) : null}
          {rupees !== null ? (
            <span className="source-figure">
              {demo ? <Sample /> : null}
              <span>{t("common.rupeesFigure", { amount: formatRupeesForDisplay(rupees) })}</span>
              <span className="figure-note">{t("common.atYourRate")}</span>
            </span>
          ) : (
            <button type="button" className="text-button" onClick={onAddBill}>
              {t("common.addAmount")}
            </button>
          )}
        </div>
        <p>{t("share.tagline")}</p>
        <small>{t("share.footline")}</small>
      </div>
      <button className="primary-button wide" onClick={() => void share()}>
        <Icon name={status === "shared" || status === "copied" ? "check" : "share"} size={18} />{" "}
        {status === "shared"
          ? t("share.shared")
          : status === "copied"
            ? t("share.copied")
            : status === "error"
              ? t("share.copyFailed")
              : t("share.share")}
      </button>
      <SourceSheet open={sourceOpen} onClose={() => setSourceOpen(false)} />
    </Sheet>
  );
}
