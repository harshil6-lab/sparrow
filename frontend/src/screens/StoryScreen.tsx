import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { ProgressBar } from "../components/ui/ProgressBar";
import { SparrowMascot } from "../components/SparrowMascot";
import { StoryFrame, STORY_FRAME_COUNT } from "../components/scenes/Scenes";
import { useAuth } from "../lib/AuthProvider";
import { storyDoneTarget } from "../lib/story";
import { STORY_URL } from "../lib/env";

export type StoryMode = "first" | "watchAgain";
type Phase = "video" | "blocked" | "frames";

/**
 * Story player. Plays the hosted video when VITE_STORY_URL is set and playable;
 * otherwise shows the five illustrated frames with Continue. Skip is available
 * from second 0.
 *
 * Gate behaviour:
 *  - Skip / video end / video error -> finish(); on the first run this sets
 *    introSeen(true) and navigates onward.
 *  - "Watch again" mode never changes introSeen.
 */
export function StoryScreen({ mode }: { mode: StoryMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { markIntroSeen } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [frame, setFrame] = useState(0);
  const [phase, setPhase] = useState<Phase>(STORY_URL ? "video" : "frames");
  const [sound, setSound] = useState(false);

  /** Single exit point for every "story is over" path. */
  const finish = () => {
    if (mode === "first") markIntroSeen(true);
    navigate(storyDoneTarget(location.pathname), { replace: true });
  };

  // Autoplay the hosted video; on refusal show the Play button, on error fall
  // back to the illustrated frames.
  useEffect(() => {
    if (phase !== "video" || !STORY_URL) return;
    const video = videoRef.current;
    if (!video) return;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => setPhase("blocked"));
    }
  }, [phase]);

  const captions = useMemo(() => [1, 2, 3, 4, 5].map((n) => t(`story.caption${n}`)), [t]);
  const lines = useMemo(() => [1, 2, 3, 4, 5].map((n) => t(`story.line${n}`)), [t]);

  const lastFrame = frame === STORY_FRAME_COUNT - 1;
  const showingFrames = phase === "frames";

  const startVideo = () => {
    setPhase("video");
    const attempt = videoRef.current?.play();
    if (attempt && typeof attempt.catch === "function") attempt.catch(() => setPhase("blocked"));
  };

  return (
    <main className="story-player">
      <Button variant="quiet" pill className="skip" onClick={finish}>
        {t("story.skip")}
      </Button>

      <div className="story-progress">
        {Array.from({ length: STORY_FRAME_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={t("story.frameLabel", { n: i + 1 })}
            className={i <= frame ? "active" : ""}
            onClick={() => {
              setFrame(i);
              setPhase("frames");
            }}
          />
        ))}
      </div>

      <div className="story-video">
        {phase === "video" && STORY_URL && (
          <video
            ref={videoRef}
            className="story-video-el"
            src={STORY_URL}
            playsInline
            muted={!sound}
            onEnded={finish}
            onError={() => setPhase("frames")}
          />
        )}

        {phase === "blocked" && (
          <div className="autoplay-blocked">
            <SparrowMascot pose="curious" size={80} />
            <strong>{t("story.ready")}</strong>
            <Button variant="sun" onClick={startVideo}>{t("story.play")}</Button>
            <button type="button" onClick={() => setPhase("frames")}>{t("story.useFallback")}</button>
          </div>
        )}

        {showingFrames && <StoryFrame index={frame} line={lines[frame]} />}
      </div>

      <div className="story-caption">
        <button type="button" className="sound" onClick={() => setSound((s) => !s)}>
          <span>♪</span> {sound ? t("story.soundOn") : t("story.sound")}
        </button>
        {showingFrames && (
          <>
            <p>{captions[frame]}</p>
            <Button variant="sun" icon="arrow" onClick={() => (lastFrame ? finish() : setFrame(frame + 1))}>
              {lastFrame ? t("story.finish") : t("story.continue")}
            </Button>
          </>
        )}
      </div>

      {showingFrames && (
        <ProgressBar value={frame + 1} max={STORY_FRAME_COUNT} label={t("story.frameLabel", { n: frame + 1 })} />
      )}
    </main>
  );
}


