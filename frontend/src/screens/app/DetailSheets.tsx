import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sheet } from "../../components/ui/Sheet";
import type { FactCard } from "../../lib/learn";
import { FACTS, hasCitableSource, visibleNote } from "../../lib/learn";

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
  const coolingCard = missionId === "ac" ? FACTS.find((card) => card.id === "ac_setpoint") : null;
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
            <small>{coolingCard ? t(coolingCard.better_habit) : t(`missions.${missionId}.what`)}</small>
          </span>
        </div>
        <div>
          <Icon name="leaf" />
          <span>
            <strong>{t("missions.whyItHelps")}</strong>
            <small>{coolingCard ? t(coolingCard.why) : t(`missions.${missionId}.why`)}</small>
          </span>
        </div>
        {coolingCard?.sources.map((source) => (
          <div key={source.url}>
            <Icon name="book" />
            <span>
              <strong>{t("learn.sourceLabel")}</strong>
              <small>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.publisher}: {source.title}
                </a>
              </small>
            </span>
          </div>
        ))}
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
  const hasSource = hasCitableSource(card);
  const why = visibleNote(t(card.why), hasSource);
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
            <small>{t(card.habit)}</small>
          </span>
        </div>
        <div>
          <Icon name="leaf" />
          <span>
            <strong>{t("learn.betterHabit")}</strong>
            <small>{t(card.better_habit)}</small>
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
        {hasSource ? card.claims?.map((claim) => (
          <div key={claim.text}>
            <Icon name="check" />
            <span>
              <strong>
                <span className={claim.kind === "estimate" ? "source-chip" : undefined}>
                  {claim.kind === "estimate" ? t("learn.estimate") : t("learn.fact")}
                </span>
              </strong>
              <small>{t(claim.text)}</small>
            </span>
          </div>
        )) : null}
        <div>
          <Icon name="check" />
          <span>
            <strong>{t("learn.sourceLabel")}</strong>
            {hasSource ? (
              <small className="source-list">
                {card.sources.map((source) => (
                  <a
                    key={source.url}
                    className="source-url-value"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.publisher}: {source.title}
                  </a>
                ))}
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
  wifiOnly,
  onClose,
}: {
  open: boolean;
  card: FactCard | null;
  clipUrl: string;
  wifiOnly: boolean;
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
            <video
              className="story-video"
              src={clipUrl}
              controls
              playsInline
              onPlay={(event) => {
                const connection = (navigator as Navigator & { connection?: { type?: string } }).connection;
                if (wifiOnly && connection?.type === "cellular" && !window.confirm(t("profile.wifiConfirm"))) {
                  event.currentTarget.pause();
                }
              }}
            />
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
