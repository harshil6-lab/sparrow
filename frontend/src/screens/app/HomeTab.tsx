import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { NeighbourhoodScene } from "../../components/scenes/NeighbourhoodScene";
import { Sample } from "../../components/ui/Sample";
import type { Bill } from "../../lib/api/data";
import { missionResult } from "../../lib/impact";
import type { WorldState } from "../../lib/world";

/** Card-1 headline per world state. The scene, the pose and this label all
 *  follow `worldState()`; nothing else may change the state. */
const CARD1_KEY: Record<WorldState, string> = {
  dawn: "home.card1Dawn",
  hazy: "home.card1Hazy",
  fresh: "home.card1Fresh",
  thriving: "home.card1Thriving",
};

/**
 * The Home tab. Layout, classes and copy are reused from the Figma export
 * ("Premium Energy Saver App"); only text is i18n'd and figures come from the
 * user's own stored bills.
 */
export function HomeTab({
  state,
  bills,
  missionDone,
  demo,
  onBill,
  onSweep,
  onOpenMission,
  onResult,
}: {
  state: WorldState;
  bills: Bill[];
  missionDone: boolean;
  demo: boolean;
  onBill: () => void;
  onSweep: () => void;
  onOpenMission: () => void;
  onResult: () => void;
}) {
  const { t } = useTranslation();
  const latest = bills[0];
  const previous = bills[1];
  const result = latest && previous ? missionResult(previous.units, latest.units) : null;
  const verified = result?.verified ?? false;
  const savedKwh = result?.kwhSaved ?? 0;

  return (
    <div className="page home-page">
      <NeighbourhoodScene
        state={state}
        pose={missionDone ? "hop" : "curious"}
        line={missionDone ? t("home.sceneDone") : t("home.sceneIdle")}
      />
      <section className="home-answer">
        <button className="home-card" onClick={onBill}>
          <span>{t("home.card1Label")}</span>
          <strong>{t(CARD1_KEY[state])}</strong>
          <small>
            {demo ? (
              <>
                <Sample /> {t("home.card1Demo")}
              </>
            ) : (
              t("home.card1Hint")
            )}
          </small>
        </button>

        <div className={`today ${missionDone ? "action-complete" : ""}`}>
          <span>{t("home.card2Label")}</span>
          <strong>{missionDone ? t("home.card2Done") : t("home.card2Todo")}</strong>
          <small>
            {missionDone ? (
              <>
                <Icon name="leaf" size={18} /> {t("home.card2Recorded")}
              </>
            ) : (
              <>
                <Icon name="clock" size={14} /> {t("home.card2Minutes")}
              </>
            )}
          </small>
          {!missionDone && (
            <button className="sun-button" onClick={onSweep}>
              {t("home.startSweep")} <Icon name="arrow" size={18} />
            </button>
          )}
          {missionDone && (
            <button
              className="completed-bird"
              onClick={onOpenMission}
              aria-label={t("home.openCompleted")}
            >
              <SparrowMascot pose="hop" size={74} />
            </button>
          )}
        </div>

        <button className="home-card" onClick={missionDone ? onOpenMission : onBill}>
          <span>{t("home.card3Label")}</span>
          <strong>
            {demo
              ? t("home.card3Demo", { kwh: savedKwh })
              : missionDone
                ? t("home.card3Done")
                : t("home.card3None")}
          </strong>
          <small>
            {demo ? (
              <>
                <Sample /> {t("common.sourcePending")}
              </>
            ) : missionDone ? (
              t("home.card3DoneHint")
            ) : (
              t("home.card3Hint")
            )}
          </small>
        </button>
      </section>

      <section className={`proof ${verified ? "verified" : ""}`}>
        <Icon name={verified ? "check" : "bill"} size={32} />
        <div>
          <span>{verified ? t("home.proofEyebrowVerified") : t("home.proofEyebrow")}</span>
          <h2>{verified ? t("home.proofTitleVerified", { kwh: savedKwh }) : t("home.proofTitle")}</h2>
          {demo && verified ? <Sample /> : null}
          <p>{verified ? t("home.proofCopyVerified") : t("home.proofCopy")}</p>
        </div>
        <button className="primary-button" onClick={verified ? onResult : onBill}>
          {verified ? t("home.viewResult") : t("home.enterBill")} <Icon name="arrow" size={18} />
        </button>
      </section>
    </div>
  );
}