import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/Button";
import { categoryKey, formatDuration, type LearnClip } from "./clips";

interface Props {
  clip: LearnClip | null;
  /** True when Wi-Fi-only is on and the device reports a cellular connection. */
  cellular: boolean;
  upNext: LearnClip[];
  /** Card id of the matching Learn habit, when one exists. */
  relatedId: string | null;
  onClose: () => void;
  onRelated: (cardId: string) => void;
  onPlayClip: (clip: LearnClip) => void;
}

/**
 * The in-frame player. Videos are only requested on tap (`preload="none"`); a
 * missing file fires `error`, which switches to the "Coming soon" panel with a
 * Retry button.
 */
export function ClipPlayerSheet({ clip, cellular, upNext, relatedId, onClose, onRelated, onPlayClip }: Props) {
  const { t } = useTranslation();
  const [allowed, setAllowed] = useState(!cellular);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAllowed(!cellular);
    setFailed(false);
    setAttempt(0);
  }, [clip, cellular]);

  if (!clip) return null;

  return (
    <div className="learn-video learn-video--player">
      <div className="learn-video__player">
        <h2>{t("learn.clips." + clip.id)}</h2>
        <span className="learn-video__meta">
          {t("learn.categories." + categoryKey(clip.category))} · {formatDuration(clip.durationSec)}
        </span>

        {!allowed ? (
          <div className="learn-video__prompt">
            <strong>{t("learn.cellularTitle")}</strong>
            <p>{t("learn.cellularCopy")}</p>
            <Button onClick={() => setAllowed(true)}>{t("learn.cellularPlay")}</Button>
            <button type="button" className="learn-video__link" onClick={onClose}>
              {t("learn.cellularCancel")}
            </button>
          </div>
        ) : failed ? (
          <div className="learn-video__error">
            <strong>{t("learn.posterSoon")}</strong>
            <p>{t("learn.playerError")}</p>
            <Button onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>{t("learn.retry")}</Button>
          </div>
        ) : (
          <video
            key={attempt}
            className="learn-video__video"
            controls
            playsInline
            preload="none"
            poster={clip.poster}
            onError={() => setFailed(true)}
          >
            <source src={clip.src} type="video/mp4" />
            {clip.captions ? <track kind="captions" src={clip.captions} srcLang={clip.captionsLang ?? "en"} label={t("learn.captions")} default /> : null}
          </video>
        )}

        <div className="learn-video__actions">
          <Button size="sm" variant="quiet" onClick={onClose}>
            {t("learn.closePlayer")}
          </Button>
          {relatedId ? (
            <button type="button" className="learn-video__link" onClick={() => onRelated(relatedId)}>
              {t("learn.relatedHabit")}
            </button>
          ) : null}
        </div>

        {upNext.length > 0 ? (
          <section className="learn-video__upnext">
            <h3>{t("learn.upNext")}</h3>
            <ul>
              {upNext.map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => onPlayClip(entry)}>
                    <span className="learn-video__upnext-dot" aria-hidden="true" />
                    {t("learn.clips." + entry.id)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
