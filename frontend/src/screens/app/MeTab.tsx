import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { EditorialArt } from "../../components/scenes/EditorialArt";
import { Sample } from "../../components/ui/Sample";
import { SourceSheet } from "../../components/ui/SourceSheet";
import type { Bill } from "../../lib/api/data";
import type { Profile } from "../../lib/types";
import {
  co2Kg,
  formatCo2KgForDisplay,
  formatKwhForDisplay,
  formatRupeesForDisplay,
  missionResult,
  rupeesSaved,
} from "../../lib/impact";
import { emissionFactor, hasEmissionFactor } from "../../lib/config";

/**
 * Totals for the Me tab. Bills are newest-first; only VERIFIED month-to-month
 * drops count, so the figures always come from the user's own bills.
 */
export function verifiedTotals(bills: Bill[]): { kwh: number; rupees: number; hasAmount: boolean } {
  let kwh = 0;
  let rupees = 0;
  let hasAmount = false;
  for (let i = 0; i + 1 < bills.length; i += 1) {
    const current = bills[i];
    const previous = bills[i + 1];
    const result = missionResult(previous.units, current.units);
    if (!result.verified) continue;
    kwh += result.kwhSaved;
    const saved = rupeesSaved(result.kwhSaved, previous.amount ?? null, previous.units);
    if (saved !== null) {
      rupees += saved;
      hasAmount = true;
    }
  }
  return { kwh, rupees, hasAmount };
}

/** "Pune · Apartment · 3 people", or the empty line for a brand-new Nest. */
function summaryKey(profile: Profile | null): string {
  const answers = profile?.answers;
  if (!answers?.city && !answers?.homeType && !answers?.people) return "me.summaryEmpty";
  return "me.summary";
}

export function MeTab({
  bills,
  demo,
  profile,
  onShare,
  onOpenProfile,
  onAddAmount,
}: {
  bills: Bill[];
  demo: boolean;
  profile: Profile | null;
  onShare: () => void;
  onOpenProfile: () => void;
  onAddAmount: () => void;
}) {
  const { t } = useTranslation();
  const [sourceOpen, setSourceOpen] = useState(false);

  const totals = verifiedTotals(bills);
  const factor = emissionFactor();
  const co2 = co2Factor(factor, totals.kwh);
  const homeKey =
    profile?.answers.homeType === "independent"
      ? "setup.homeIndependent"
      : profile?.answers.homeType === "row"
        ? "setup.homeRow"
        : "setup.homeApartment";
  const initials = (profile?.user.displayName ?? "S")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="page me-page">
      <EditorialArt
        kind="evening"
        pose="curious"
        line={demo ? t("me.sceneDemo") : t("me.sceneZero")}
      />

      <div className="profile">
        <button className="avatar large" aria-label={t("app.openProfile")} onClick={onOpenProfile}>
          {initials}
        </button>
        <div>
          <span>{t("app.nestName")}</span>
          <h1>{t("me.title")}</h1>
          <p>
            {summaryKey(profile) === "me.summaryEmpty"
              ? t("me.summaryEmpty")
              : t("me.summary", {
                  city: profile?.answers.city ?? t("me.summaryUnknown"),
                  home: t(homeKey),
                  people: profile?.answers.people ?? t("me.summaryUnknown"),
                })}
          </p>
        </div>
        <button type="button" onClick={onOpenProfile}>
          <Icon name="settings" /> {t("me.settings")}
        </button>
      </div>

      <section className="impact">
        <div>
          <span>{t("me.energySaved")}</span>
          <strong>
            {formatKwhForDisplay(totals.kwh)} <small>{t("me.kwhUnit")}</small>
          </strong>
          {demo ? <Sample /> : null}
        </div>
        <div>
          <span>{t("me.keptAtHome")}</span>
          <strong>
            {t("common.rupeesFigure", {
              amount: formatRupeesForDisplay(totals.hasAmount ? totals.rupees : 0),
            })}
          </strong>
          {demo ? <Sample /> : null}
          {totals.hasAmount ? (
            <small className="figure-note">{t("common.atYourRate")}</small>
          ) : (
            <button type="button" className="text-button" onClick={onAddAmount}>
              {t("common.addAmount")}
            </button>
          )}
        </div>
        <div>
          <span>{t("me.co2Avoided")}</span>
          {co2 !== null ? (
            <>
              <strong>
                {t("common.co2Figure", { kg: formatCo2KgForDisplay(co2) })}
              </strong>
              {demo ? <Sample /> : null}
              <button type="button" className="source-button" onClick={() => setSourceOpen(true)}>
                {t("common.source")}
              </button>
            </>
          ) : (
            <strong>{t("common.sourcePending")}</strong>
          )}
        </div>
      </section>

      <button className="primary-button share-impact" onClick={onShare}>
        <Icon name="share" size={18} /> {t("me.share")}
      </button>

      <SourceSheet open={sourceOpen} onClose={() => setSourceOpen(false)} />
    </div>
  );
}

/** CO2 from the known kWh total, or null when the grid factor is unsourced. */
function co2Factor(factor: number | null, kwh: number): number | null {
  if (!hasEmissionFactor || factor === null) return null;
  return kwh > 0 ? co2Kg(kwh, factor) : 0;
}
