import { useTranslation } from "react-i18next";
import { Icon } from "../Icon";
import { Sheet } from "./Sheet";
import { config } from "../../lib/config";

/**
 * The "Source" sheet for the CO2 figure: names the CEA grid-factor database,
 * its version and year, and shows the source URL as text. The citation comes
 * from data/config.json; when it is unsourced the sheet says so rather than
 * inventing one.
 */
export function SourceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const source = config.gridEmissionFactorSource;
  const url = config.gridEmissionFactorUrl;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("source.title")}
      sheetClassName="sheet source-sheet"
      closeLabel={t("source.close")}
    >
      <div className="sheet-icon">
        <Icon name="leaf" size={30} />
      </div>
      <div className="eyebrow">{t("source.eyebrow")}</div>
      <h2>{t("source.title")}</h2>
      <p>{source ? t("source.body", { source }) : t("common.sourcePending")}</p>
      {url ? (
        <p className="source-url">
          <span>{t("source.urlLabel")}</span>
          <span className="source-url-value">{url}</span>
        </p>
      ) : null}
      <p>
        <small>{t("source.note")}</small>
      </p>
    </Sheet>
  );
}
