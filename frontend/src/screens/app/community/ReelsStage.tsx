import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/Button";
import type { CommunityPost, CommunityTag, ReactionType } from "../../../lib/api/data";
import type { HttpError } from "../../../lib/api/http";
import { ReelsPost } from "./ReelsPost";
import { COMMUNITY_TAGS } from "./tags";

const NEXT: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  PageDown: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
  PageUp: -1,
};

interface Props {
  posts: CommunityPost[];
  tag: CommunityTag | "all";
  onTag: (tag: CommunityTag | "all") => void;
  demo: boolean;
  loading: boolean;
  error: HttpError | null;
  emptyLabel: string;
  onRetry: () => void;
  onCreate: () => void;
  cursor: string | null;
  onLoadMore: () => void;
  onReact: (post: CommunityPost, next: ReactionType | null) => void;
  onDoubleTap: (post: CommunityPost) => void;
  onComments: (post: CommunityPost) => void;
  onShare: (post: CommunityPost) => void;
  onReport: (post: CommunityPost) => void;
  onDelete: (post: CommunityPost) => void;
}

/** The full-bleed, scroll-snapping reels stage behind the Community tab. */
export function ReelsStage({
  posts, tag, onTag, demo, loading, error, emptyLabel, onRetry, onCreate, cursor, onLoadMore,
  onReact, onDoubleTap, onComments, onShare, onReport, onDelete,
}: Props) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const firstId = posts.length > 0 ? posts[0].id : "";
  useEffect(() => {
    setActiveIndex(0);
    const track = trackRef.current;
    if (track) track.scrollTop = 0;
  }, [firstId]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const height = track.clientHeight || 1;
      const next = Math.max(0, Math.min(posts.length - 1, Math.round(track.scrollTop / height)));
      setActiveIndex((current) => (current === next ? current : next));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [posts.length]);

  useEffect(() => {
    if (cursor && posts.length > 0 && activeIndex >= posts.length - 3) onLoadMore();
  }, [activeIndex, cursor, posts.length, onLoadMore]);

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(posts.length - 1, target));
      setActiveIndex(clamped);
      const slide = trackRef.current?.children.item(clamped);
      if (slide instanceof HTMLElement && typeof slide.scrollIntoView === "function") {
        slide.scrollIntoView({ block: "start" });
      }
    },
    [posts.length],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = NEXT[event.key];
    if (!delta) return;
    event.preventDefault();
    goTo(activeIndex + delta);
  };

  const hasPosts = posts.length > 0;

  return (
    <div className="community-reels community-reels--stage">
      <header className="community-reels__top">
        <div className="community-reels__bar">
          <h1>{t("community.title")}</h1>
          {hasPosts ? <span className="community-reels__counter">{t("community.positionOf", { index: activeIndex + 1, total: posts.length })}</span> : null}
          <button type="button" className="community-reels__create" aria-label={t("community.postButton")} onClick={onCreate}>
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <div className="community-reels__chips" aria-label={t("community.filterLabel")}>
          <button type="button" className={tag === "all" ? "is-on" : ""} aria-pressed={tag === "all"} onClick={() => onTag("all")}>
            {t("community.all")}
          </button>
          {COMMUNITY_TAGS.map((entry) => (
            <button key={entry} type="button" className={tag === entry ? "is-on" : ""} aria-pressed={tag === entry} onClick={() => onTag(entry)}>
              {t("community.tags." + entry)}
            </button>
          ))}
        </div>
        {demo ? <p className="community-reels__demo">{t("community.demoBanner")}</p> : null}
      </header>

      {loading && !hasPosts ? (
        <div className="community-reels__state" aria-busy="true">
          <div className="community-reels__skeleton" />
          <span>{t("community.loading")}</span>
        </div>
      ) : null}

      {error && !hasPosts ? (
        <div className="community-reels__state">
          <strong>{t("community.error")}</strong>
          <span>{t("community.details", { status: error.status, code: error.errorCode })}</span>
          <Button size="sm" onClick={onRetry}>
            {t("community.retry")}
          </Button>
        </div>
      ) : null}

      {!loading && !error && !hasPosts ? (
        <div className="community-reels__state">
          <strong>{emptyLabel}</strong>
        </div>
      ) : null}

      <div className="community-reels__track" ref={trackRef} tabIndex={0} role="group" aria-label={t("community.reelsLabel")} onKeyDown={onKeyDown}>
        {posts.map((post, index) => (
          <ReelsPost
            key={post.id}
            post={post}
            active={index === activeIndex}
            mounted={Math.abs(index - activeIndex) <= 1}
            demo={demo}
            onReact={onReact}
            onDoubleTap={onDoubleTap}
            onComments={onComments}
            onShare={onShare}
            onReport={onReport}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
