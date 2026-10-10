import { useTranslation } from "react-i18next";
import { Sheet } from "../../components/ui/Sheet";
import type { Bill } from "../../lib/api/data";
import { VerificationResult } from "./VerificationResult";

/**
 * Home's "View result" sheet — the latest verification, using the same math and
 * markup as the bill sheet's result.
 */
export function ResultSheet({
  open,
  onClose,
  bills,
  demo,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  bills: Bill[];
  demo: boolean;
  onShare: (kwh: number) => void;
}) {
  const { t } = useTranslation();
  const latest = bills[0];
  const previous = bills[1];
  const ready = Boolean(latest && previous);

  return (
    <Sheet
      open={open && ready}
      onClose={onClose}
      label={t("home.viewResult")}
      sheetClassName="sheet bill-sheet"
      closeLabel={t("bill.close")}
    >
      {latest && previous ? (
        <VerificationResult previous={previous} bill={latest} demo={demo} onShare={onShare} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}