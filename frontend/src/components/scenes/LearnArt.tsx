import { useTranslation } from "react-i18next";
import type { IconName } from "../Icon";

/**
 * Small Learn card illustration, reused verbatim from the Figma Make export.
 * The one visible label ("24-26 deg") comes from i18n, like every other string.
 */
export function LearnArt({ type }: { type: IconName }) {
  const { t } = useTranslation();
  return (
    <div className={`learn-art ${type}`}>
      <div className="mini-sun" />
      <div className="mini-home" />
      {type === "ac" && <div className="mini-ac">{t("learn.acArt")}</div>}
      {type === "bolt" && <div className="mini-plug"><i /></div>}
      {type === "fridge" && <div className="mini-fridge"><i /></div>}
      {type === "washer" && <div className="mini-washer"><i /></div>}
    </div>
  );
}
