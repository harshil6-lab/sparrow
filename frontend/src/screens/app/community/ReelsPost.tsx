import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../../components/Icon";
import { SparrowMascot } from "../../../components/SparrowMascot";
import type { CommunityPost, ReactionType } from "../../../lib/api/data";
import { CommentGlyph, MoreGlyph } from "./glyphs";
import { REACTION_ORDER, ReactionIcon } from "./reactions";
import { relativeTime } from "./time";

const CLAMP_AT = 90;

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  post: CommunityPost;
  /** True while this slide is the snapped one. */
  active: boolean;
  /** True when the slide is within +/-1 of the active slide. */
  mounted: boolean;
  demo: boolean;
  onReact: (post: CommunityPost, next: ReactionType | null) => void;
  onDoubleTap: (post: CommunityPost) => void;
  onComments: (post: CommunityPost) => void;
  onShare: (post: CommunityPost) => void;
  onReport: (post: CommunityPost) => void;
  onDelete: (post: CommunityPost) => void;
}

/** One full-height reel: photo, scrims, caption and the right-hand rail. */
export function ReelsPost({ post, active, mounted, demo, onReact, onDoubleTap, onComments, onShare, onReport, onDelete }: Props) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen && !moreOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [pickerOpen, moreOpen]);

  useEffect(() => {
    if (!active) {
      setPickerOpen(false);
      setMoreOpen(false);
    }
  }, [active]);

  const total = REACTION_ORDER.reduce((sum, type) => sum + (post.reactionCounts[type] ?? 0), 0);
  const clamped = post.caption.length > CLAMP_AT;

  const doubleTap = () => {
    onDoubleTap(post);
    if (!reducedMotion()) setBurst(Date.now());
  };

  return (
    <article className="community-reels__post" aria-label={demo ? t("community.samplePost") : undefined}>
      <div className="community-reels__media" onDoubleClick={doubleTap}>
        {post.photoUrl === null ? (
          <div className="community-reels__illustration">
            <SparrowMascot size={104} />
          </div>
        ) : mounted ? (
          <>
            <img className="community-reels__backdrop" src={post.photoUrl} alt="" aria-hidden="true" />
            <img className="community-reels__photo" src={post.photoUrl} alt={t("community.postPhoto")} />
          </>
        ) : (
          <div className="community-reels__photo community-reels__photo--idle" aria-hidden="true" />
        )}

        <div className="community-reels__scrim community-reels__scrim--top" aria-hidden="true" />
        <div className="community-reels__scrim community-reels__scrim--bottom" aria-hidden="true" />

        {demo ? <span className="community-reels__sample">{t("common.sample")}</span> : null}
        {post.status === "hidden" ? <span className="community-reels__pill">{t("community.youOnly")}</span> : null}
        {burst > 0 ? (
          <span className="community-reels__burst" key={burst} aria-hidden="true">
            <ReactionIcon type="love" size={110} />
          </span>
        ) : null}
      </div>

      <div className="community-reels__meta">
        <span className="community-reels__avatar" aria-hidden="true">
          {post.authorName.charAt(0).toUpperCase()}
        </span>
        <div className="community-reels__who">
          <div>
            <strong>{post.authorName}</strong>
            <span className="community-reels__tag">{t("community.tags." + post.tag)}</span>
            <span className="community-reels__time">{relativeTime(post.createdAt)}</span>
          </div>
          <p className={clamped && !expanded ? "community-reels__caption community-reels__caption--clamped" : "community-reels__caption"}>
            {post.caption}
          </p>
          {clamped ? (
            <button
              type="button"
              className="community-reels__caption-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? t("community.captionLess") : t("community.captionMore")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="community-reels__rail" ref={railRef}>
        <div className="community-reels__rail-item">
          <button
            type="button"
            className={post.myReaction ? "community-reels__rail-button community-reels__rail-button--on" : "community-reels__rail-button"}
            aria-label={t("community.react")}
            aria-pressed={Boolean(post.myReaction)}
            aria-expanded={pickerOpen}
            data-reaction={post.myReaction ?? "none"}
            onClick={() => {
              setMoreOpen(false);
              setPickerOpen((value) => !value);
            }}
          >
            <ReactionIcon type={post.myReaction ?? "grow"} />
          </button>
          <span className="community-reels__rail-count">{total}</span>
          {pickerOpen ? (
            <div className="community-reels__picker" role="group" aria-label={t("community.react")}>
              {REACTION_ORDER.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="community-reels__picker-button"
                  data-reaction={type}
                  aria-label={t("community.reactions." + type)}
                  aria-pressed={post.myReaction === type}
                  onClick={() => {
                    onReact(post, post.myReaction === type ? null : type);
                    setPickerOpen(false);
                  }}
                >
                  <ReactionIcon type={type} size={30} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="community-reels__rail-item">
          <button
            type="button"
            className="community-reels__rail-button"
            aria-label={t("community.comments", { count: post.commentCount })}
            onClick={() => onComments(post)}
          >
            <CommentGlyph />
          </button>
          <span className="community-reels__rail-count">{post.commentCount}</span>
        </div>

        <div className="community-reels__rail-item">
          <button type="button" className="community-reels__rail-button" aria-label={t("community.share")} onClick={() => onShare(post)}>
            <Icon name="share" />
          </button>
        </div>

        <div className="community-reels__rail-item">
          <button
            type="button"
            className="community-reels__rail-button"
            aria-label={t("community.moreOptions")}
            aria-expanded={moreOpen}
            onClick={() => {
              setPickerOpen(false);
              setMoreOpen((value) => !value);
            }}
          >
            <MoreGlyph />
          </button>
          {moreOpen ? (
            <div className="community-reels__menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onReport(post); }}>
                {t("community.reportPost")}
              </button>
              {post.isMine ? (
                <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onDelete(post); }}>
                  {t("community.deletePost")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}