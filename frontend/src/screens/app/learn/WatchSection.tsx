import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LearnArt } from "../../../components/scenes/LearnArt";
import { categoryArt, categoryKey, formatDuration, type LearnClip } from "./clips";

function PlayGlyph() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 5.5 19 12 8 18.5v-13Z" fill="currentColor" />
    </svg>
  );
}

function VideoCard({ clip, onPlay }: { clip: LearnClip; onPlay: () => void }) {
  const { t } = useTranslation();
  const [posterFailed, setPosterFailed] = useState(false);
  const title = t("learn.clips." + clip.id);

  return (
    <li className="learn-video__card">
      <button type="button" className="learn-video__thumb" aria-label={t("learn.playClip", { title })} onClick={onPlay}>
        {posterFailed ? (
          <span className="learn-video__poster-fallback">
            <LearnArt type={categoryArt(clip.category)} />
          </span>
        ) : (
          <img src={clip.poster} alt="" aria-hidden="true" loading="lazy" onError={() => setPosterFailed(true)} />
        )}
        <span className="learn-video__play" aria-hidden="true">
          <PlayGlyph />
        </span>
        <span className="learn-video__duration">{formatDuration(clip.durationSec)}</span>
        {posterFailed ? <span className="learn-video__soon">{t("learn.posterSoon")}</span> : null}
      </button>
      <div className="learn-video__body">
        <strong>{title}</strong>
        <span className="learn-video__chip">{t("learn.categories." + categoryKey(clip.category))}</span>
      </div>
    </li>
  );
}

/** "Watch" — a YouTube-style clip list with a category filter row. */
export function WatchSection({ clips, onPlay }: { clips: LearnClip[]; onPlay: (clip: LearnClip) => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => [...new Set(clips.map((clip) => clip.category))], [clips]);
  const shown = category === "all" ? clips : clips.filter((clip) => clip.category === category);

  return (
    <section className="learn-video learn-video--grid" aria-labelledby="learn-watch-title">
      <div className="learn-video__head">
        <h2 id="learn-watch-title">{t("learn.watchTitle")}</h2>
        <p>{t("learn.watchCopy")}</p>
      </div>
      <div className="learn-video__filters" role="group" aria-label={t("learn.watchTitle")}>
        <button type="button" className={category === "all" ? "is-on" : ""} aria-pressed={category === "all"} onClick={() => setCategory("all")}>
          {t("learn.allCategories")}
        </button>
        {categories.map((entry) => (
          <button key={entry} type="button" className={category === entry ? "is-on" : ""} aria-pressed={category === entry} onClick={() => setCategory(entry)}>
            {t("learn.categories." + categoryKey(entry))}
          </button>
        ))}
      </div>
      <ul className="learn-video__list">
        {shown.map((clip) => (
          <VideoCard key={clip.id} clip={clip} onPlay={() => onPlay(clip)} />
        ))}
      </ul>
    </section>
  );
}