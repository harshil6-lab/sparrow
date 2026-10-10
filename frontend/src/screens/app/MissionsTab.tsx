import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { MISSIONS, RECOMMENDED_MISSION_ID, isMissionDone } from "../../lib/missions";

/**
 * Missions tab. Markup and classes are reused from the Figma export
 * ("Premium Energy Saver App"): one recommended hero (the standby sweep) plus
 * the cooling / daylight / hot-water list. Every card opens a detail sheet.
 */
export function MissionsTab({
  missionsDone,
  onStartSweep,
  onOpenMission,
}: {
  missionsDone: string[];
  /** Not yet done: the hero opens the existing sweep flow. */
  onStartSweep: () => void;
  onOpenMission: (missionId: string) => void;
}) {
  const { t } = useTranslation();
  const recommendedDone = isMissionDone(missionsDone, RECOMMENDED_MISSION_ID);

  return (
    <div className="page missions-page">
      <div className="page-heading">
        <span>{t("missions.eyebrow")}</span>
        <h1>{t("missions.title")}</h1>
      </div>

      <button
        type="button"
        className={`standby-mission ${recommendedDone ? "complete" : ""}`}
        onClick={() => (recommendedDone ? onOpenMission(RECOMMENDED_MISSION_ID) : onStartSweep())}
      >
        <div className="night-room">
          <div className="moon" />
          <div className="tv"><i /></div>
          <div className="router"><i /></div>
          <div className="mission-persona">
            <div className="art-speech">
              {recommendedDone ? t("missions.sweepLineDone") : t("missions.sweepLine")}
            </div>
            <SparrowMascot pose={recommendedDone ? "hop" : "ruffled"} size={86} />
          </div>
        </div>
        <div>
          <span>{recommendedDone ? t("missions.doneToday") : t("missions.recommended")}</span>
          <h2>{t("missions.standby_sweep.title")}</h2>
          <p>{t("missions.standby_sweep.hint")}</p>
          <strong className="complete-line">
            <Icon name={recommendedDone ? "leaf" : "arrow"} />{" "}
            {recommendedDone ? t("missions.doneToday") : t("missions.openMission")}
          </strong>
        </div>
      </button>

      {MISSIONS.length === 0 ? (
        <div className="empty-state">
          <SparrowMascot pose="curious" size={70} />
          <div>
            <strong>{t("missions.emptyTitle")}</strong>
            <span>{t("missions.emptyCopy")}</span>
          </div>
        </div>
      ) : (
        <section className="next-missions">
          {MISSIONS.map((mission) => {
            const done = isMissionDone(missionsDone, mission.id);
            return (
              <button key={mission.id} type="button" onClick={() => onOpenMission(mission.id)}>
                <Icon name={mission.icon} />
                <span>{t(`missions.${mission.id}.category`)}</span>
                <h3>{t(`missions.${mission.id}.title`)}</h3>
                {done ? (
                  <small className="mission-done">
                    <Icon name="check" size={16} /> {t("missions.doneToday")}
                  </small>
                ) : (
                  <small>{t(`missions.${mission.id}.hint`)}</small>
                )}
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
