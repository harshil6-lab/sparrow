import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sheet } from "../../components/ui/Sheet";
import type { FactCard } from "../../lib/learn";
import { visibleNote } from "../../lib/learn";

/**
 * Mission detail sheet, reused from the Figma export's DetailSheet:
 * what to do, why it helps, the time it takes, and "Mark as done".
 * Marking done records the action and never moves the world state.
 */
export function MissionDetailSheet({
  open,
  missionId,
  done,
  onDone,
  onClose,
}: {
  open: boolean;
  missionId: string;
  done: boolean;
  onDone: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("missions.detailEyebrow")}
      sheetClassName="sheet detail-sheet"
      closeLabel={t("common.close")}
    >
      <SparrowMascot pose={done ? "hop" : "curious"} size={85} />
      <div className="eyebrow">{t("missions.detailEyebrow")}</div>
      <h2>{t(`missions.${missionId}.title`)}</h2>
      <div className="detail-facts">
        <div>
          <Icon name="check" />
          <span>
            <strong>{t("missions.whatToDo")}</strong>
            <small>{t(`missions.${missionId}.what`)}</small>
          </span>
        </div>
        <div>
          <Icon name="leaf" />
          <span>
            <strong>{t("missions.whyItHelps")}</strong>
            <small>{t(`missions.${missionId}.why`)}</small>
          </span>
        </div>
        <div>
          <Icon name="clock" />
          <span>
            <strong>{t("missions.time")}</strong>
            <small>{t("missions.minutes")}</small>
          </span>
        </div>
      </div>
      <button className="primary-button wide" onClick={onDone} disabled={done}>
        {done ? t("missions.done") : t("missions.markDone")} <Icon name="check" size={18} />
      </button>
    </Sheet>
  );
}

/**
 * Learn note detail: the Habit / Better habit / Why rows, a source link when
 * one is cited (otherwise the "source pending" chip) and the clip action.
 */
export function LearnDetailSheet({
  open,
  card,
  saved,
  onSave,
  onWatch,
  onClose,
}: {
  open: boolean;
  card: FactCard | null;
  saved: boolean;
  onSave: () => void;
  onWatch: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!card) return null;
  const why = visibleNote(t(`learn.${card.id}.why`), card.source);
  const sourceText = t("common.sourcePending");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("learn.detailEyebrow")}
      sheetClassName="sheet detail-sheet"
      closeLabel={t("common.close")}
    >
      <SparrowMascot pose="curious" size={85} />
      <div className="eyebrow">{t("learn.detailEyebrow")}</div>
      <h2>{t(`learn.${card.id}.category`)}</h2>
      <div className="detail-facts">
        <div>
          <Icon name="bulb" />
          <span>
            <strong>{t("learn.habit")}</strong>
            <small>{t(`learn.${card.id}.habit`)}</small>
          </span>
        </div>
        <div>
          <Icon name="leaf" />
          <span>
            <strong>{t("learn.betterHabit")}</strong>
            <small>{t(`learn.${card.id}.better`)}</small>
          </span>
        </div>
        {why ? (
          <div>
            <Icon name="book" />
            <span>
              <strong>{t("learn.why")}</strong>
              <small>{why}</small>
            </span>
          </div>
        ) : null}
        <div>
          <Icon name="check" />
          <span>
            <strong>{t("learn.sourceLabel")}</strong>
            {card.source ? (
              <small>
                <a className="source-url-value" href={card.source} target="_blank" rel="noreferrer">
                  {card.source}
                </a>
              </small>
            ) : (
              <small>
                <span className="source-chip">{sourceText}</span>
              </small>
            )}
          </span>
        </div>
      </div>
      <div className="result-actions">
        <button className="quiet-button" onClick={onWatch}>
          {t("learn.watch")}
        </button>
        <button className="primary-button" onClick={onSave}>
          {saved ? t("learn.savedNote") : t("learn.saveNote")} <Icon name="check" size={18} />
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Clip bottom sheet. When no clip URL is configured it says "Coming soon" and
 * shows no duration, progress bar or caption — nothing is invented.
 */
export function ClipSheet({
  open,
  card,
  clipUrl,
  onClose,
}: {
  open: boolean;
  card: FactCard | null;
  clipUrl: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!card) return null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("learn.clipLabel")}
      sheetClassName="clip-sheet"
      closeLabel={t("common.close")}
    >
      {clipUrl ? (
        <>
          <div className="clip-stage">
            <video className="story-video" src={clipUrl} controls playsInline />
          </div>
          <h2>{t(`learn.${card.id}.category`)}</h2>
          <p className="clip-caption">{t("learn.clipCaption")}</p>
        </>
      ) : (
        <>
          <h2>{t("learn.comingSoon")}</h2>
          <p className="clip-caption">{t("learn.comingSoonCopy")}</p>
        </>
      )}
    </Sheet>
  );
}
