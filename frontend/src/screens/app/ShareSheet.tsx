import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowLogo } from "../../components/SparrowLogo";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sample } from "../../components/ui/Sample";
import { Sheet } from "../../components/ui/Sheet";
import { useAuth } from "../../lib/AuthProvider";

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
}: {
  open: boolean;
  onClose: () => void;
  kwh: number;
  demo: boolean;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (open) setStatus("idle");
  }, [open]);

  const name = (profile?.user.displayName ?? "S").split(" ")[0].toUpperCase();
  const figure = formatKwh(kwh);

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
    </Sheet>
  );
}