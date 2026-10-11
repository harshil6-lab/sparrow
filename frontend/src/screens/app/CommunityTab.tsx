import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { api } from "../../lib/api";
import type { CommunityPost, CommunityTag, ReactionType, ReportReason } from "../../lib/api/data";
import { HttpError } from "../../lib/api/http";
import { compressBillPhoto } from "../../lib/photos";
import { useAuth } from "../../lib/AuthProvider";
import { CommentsSheet } from "./community/CommentsSheet";
import { ReelsStage } from "./community/ReelsStage";
import { COMMUNITY_TAGS } from "./community/tags";
import "../../styles/community-reels.css";

const NAME_RE = /^[\p{L}\p{N} .\-_']+$/u;

export function CommunityTab({ demo, onSignUp }: { demo: boolean; onSignUp: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { profile, saveProfile } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const loadingMore = useRef(false);
  const [filter, setFilter] = useState<CommunityTag | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HttpError | null>(null);
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);
  const [reportPost, setReportPost] = useState<CommunityPost | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState<CommunityTag>("energy_saving");
  const [adult, setAdult] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState(false);
  const [posting, setPosting] = useState(false);
  const [nameStep, setNameStep] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const measure = () => {
      const before = page.previousElementSibling as HTMLElement | null;
      const offset = before && before.classList.contains("demo-banner") ? before.offsetHeight : 0;
      page.style.setProperty("--reels-chrome", `${offset}px`);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const before = page.previousElementSibling;
    if (observer && before) observer.observe(before);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [demo]);

  const openCreate = () => {
    if (demo) { onSignUp(); return; }
    const key = `sparrow.community.guidelines.${profile?.user.id ?? "unknown"}`;
    if (!localStorage.getItem(key)) {
      setGuidelinesOpen(true);
      localStorage.setItem(key, "1");
    } else {
      setCreateOpen(true);
    }
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(false);
    try {
      const compressed = await compressBillPhoto(file);
      setPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      setPhotoProgress(0);
    } catch {
      setPhoto(null);
      setPhotoPreview(null);
      setPhotoError(true);
    }
  };

  const load = useCallback(async (append = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.data.community.getCommunityFeed(20, append ? cursorRef.current : null);
      setPosts((previous) => (append ? [...previous, ...result.posts] : result.posts));
      setCursor(result.cursor);
      cursorRef.current = result.cursor;
    } catch (err) {
      setError(err instanceof HttpError ? err : new HttpError(0, t("community.networkError"), "network_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [demo, load]);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("post");
    if (!id) return;
    void api.data.community.getCommunityPost(id).then(setCommentsPost).catch((err: unknown) => {
      if (err instanceof HttpError && (err.status === 404 || err.errorCode === "not_found")) setUnavailable(true);
      else setError(err instanceof HttpError ? err : new HttpError(0, t("community.networkError"), "network_error"));
    });
  }, [location.search, t]);

  const visible = useMemo(() => filter === "all" ? posts : posts.filter((post) => post.tag === filter), [filter, posts]);

  const handleCommunityError = useCallback((err: unknown, postId?: string) => {
    const apiError = err instanceof HttpError ? err : new HttpError(0, t("community.networkError"), "network_error");
    if (apiError.status === 404 || apiError.errorCode === "not_found") {
      if (postId) setPosts((items) => items.filter((item) => item.id !== postId));
      setToast(t("community.unavailable"));
      window.setTimeout(() => setToast(""), 2500);
    } else if (apiError.errorCode === "rate_limited") {
      setError(new HttpError(apiError.status, t("community.rateLimited"), apiError.errorCode));
    } else {
      setError(apiError);
    }
  }, [t]);

  const react = useCallback(async (post: CommunityPost, next: ReactionType | null) => {
    const before = post;
    setPosts((items) => items.map((item) => item.id === post.id ? { ...item, myReaction: next, reactionCounts: { ...item.reactionCounts, ...(post.myReaction ? { [post.myReaction]: Math.max(0, post.reactionCounts[post.myReaction] - 1) } : {}), ...(next ? { [next]: post.reactionCounts[next] + 1 } : {}) } } : item));
    try {
      const updated = await api.data.community.setCommunityReaction(post.id, next);
      setPosts((items) => items.map((item) => item.id === post.id ? updated : item));
    } catch (err) {
      setPosts((items) => items.map((item) => item.id === post.id ? before : item));
      handleCommunityError(err, post.id);
    }
  }, [handleCommunityError]);

  const doubleTap = useCallback((post: CommunityPost) => {
    if (post.myReaction === "love") return;
    void react(post, "love");
  }, [react]);

  const share = useCallback((post: CommunityPost) => {
    const link = `${window.location.origin}/app/community?post=${encodeURIComponent(post.id)}`;
    const text = `${post.caption.slice(0, 80)}\n${link}`;
    if (navigator.share) {
      void navigator.share({ text, url: link }).catch(() => undefined);
    } else if (navigator.clipboard) {
      void navigator.clipboard.writeText(link).then(() => { setToast(t("community.linkCopied")); window.setTimeout(() => setToast(""), 2000); }).catch((err) => handleCommunityError(err));
    } else {
      setToast(t("community.linkCopied"));
    }
  }, [handleCommunityError, t]);

  const removePost = useCallback((post: CommunityPost) => {
    void api.data.community.deleteCommunityPost(post.id)
      .then(() => setPosts((items) => items.filter((item) => item.id !== post.id)))
      .catch((err) => handleCommunityError(err, post.id));
  }, [handleCommunityError]);

  const loadMore = useCallback(() => {
    if (loadingMore.current || !cursorRef.current) return;
    loadingMore.current = true;
    void load(true).finally(() => { loadingMore.current = false; });
  }, [load]);

  const create = async () => {
    if (demo) { onSignUp(); return; }
    if (!photo || !caption.trim() || !adult) return;
    if (!profile?.displayName && !displayName) {
      setNameStep(true);
      return;
    }
    setPosting(true);
    try {
      if (!profile?.displayName) {
        if (displayName.length < 2 || displayName.length > 40 || !NAME_RE.test(displayName)) {
          setPosting(false);
          return;
        }
        await saveProfile({ ...profile!, displayName });
      }
      const post = await api.data.community.createCommunityPost({ photo, caption: caption.trim(), tag, confirmAdult: adult, onProgress: setPhotoProgress });
      setPosts((items) => [post, ...items]);
      setCreateOpen(false);
      setCaption(""); setPhoto(null); setPhotoPreview(null); setAdult(false); setPhotoProgress(0);
    } catch (err) {
      const apiError = err instanceof HttpError ? err : new HttpError(0, t("community.networkError"), "network_error");
      if (apiError.errorCode === "needs_display_name") {
        setNameStep(true);
      } else if (apiError.errorCode === "moderation_rejected") {
        setError(new HttpError(apiError.status, t("community.moderationRejected"), apiError.errorCode));
      } else if (apiError.errorCode === "moderation_unavailable") {
        setError(new HttpError(apiError.status, t("community.moderationUnavailable"), apiError.errorCode));
      } else if (apiError.errorCode === "rate_limited") {
        setError(new HttpError(apiError.status, t("community.rateLimited"), apiError.errorCode));
      } else {
        setError(apiError);
      }
    } finally { setPosting(false); }
  };

  return (
    <div className="community-page community-reels--page" ref={pageRef}>
      {toast ? <div className="toast" role="status">{toast}</div> : null}

      <ReelsStage
        posts={visible}
        tag={filter}
        onTag={setFilter}
        demo={demo}
        loading={loading}
        error={error}
        emptyLabel={unavailable ? t("community.unavailable") : t("community.empty")}
        onRetry={() => void load()}
        onCreate={openCreate}
        cursor={cursor}
        onLoadMore={loadMore}
        onReact={(post, next) => void react(post, next)}
        onDoubleTap={doubleTap}
        onComments={setCommentsPost}
        onShare={share}
        onReport={setReportPost}
        onDelete={removePost}
      />

      <Sheet open={Boolean(reportPost)} onClose={() => setReportPost(null)} label={t("community.reportTitle")} closeLabel={t("common.close")}>
        <h2>{t("community.reportTitle")}</h2>
        {(["spam", "inappropriate", "unsafe", "other"] as ReportReason[]).map((reason) => <Button key={reason} variant="quiet" wide onClick={() => {
          if (reportPost) void api.data.community.reportCommunityPost(reportPost.id, reason).then(() => setPosts((items) => items.filter((item) => item.id !== reportPost.id))).catch((err: unknown) => setError(err instanceof HttpError ? err : new HttpError(0, t("community.networkError"), "network_error")));
          setReportPost(null);
        }}>{t(`community.report.${reason}`)}</Button>)}
      </Sheet>

      <Sheet open={Boolean(commentsPost)} onClose={() => setCommentsPost(null)} label={t("community.commentsTitle")} closeLabel={t("common.close")}>
        <CommentsSheet post={commentsPost} onError={handleCommunityError} />
      </Sheet>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} label={t("community.createTitle")} closeLabel={t("common.close")} sheetClassName="sheet community-create-sheet">
        {nameStep ? <div className="community-name-step">
          <h2>{t("community.nameTitle")}</h2>
          <label htmlFor="community-display-name">{t("community.nameLabel")}</label>
          <input id="community-display-name" value={displayName} minLength={2} maxLength={40} aria-describedby="community-name-help" onChange={(event) => setDisplayName(event.target.value)} />
          <small id="community-name-help" className="field-hint">{t("community.nameHelp")}</small>
          {displayName.length > 0 && (displayName.length < 2 || displayName.length > 40 || !NAME_RE.test(displayName)) ? <div className="inline-error">{t("community.nameInvalid")}</div> : null}
          <Button wide disabled={displayName.length < 2 || displayName.length > 40 || !NAME_RE.test(displayName)} onClick={() => { setNameStep(false); void create(); }}>{t("community.continue")}</Button>
        </div> : <div className="community-create-layout">
        <div className="community-create-body">
          <h2>{t("community.createTitle")}</h2>
          <div className="community-photo-picker">
            {photoPreview ? <div className="community-preview"><img src={photoPreview} alt={t("community.photoPreview")} /><div className="photo-actions">
              <button type="button" className="quiet-button" onClick={() => fileRef.current?.click()}>{t("community.replace")}</button>
              <button type="button" className="quiet-button" onClick={() => { setPhoto(null); setPhotoPreview(null); setPhotoProgress(0); }}>{t("community.remove")}</button>
            </div></div> : <div className="community-photo-tile">
              <strong>{t("community.photoLabel")}</strong>
              <div className="photo-actions">
                <button type="button" className="quiet-button" onClick={() => fileRef.current?.click()}>{t("community.takePhoto")}</button>
                <button type="button" className="quiet-button" onClick={() => document.getElementById("community-gallery")?.click()}>{t("community.choosePhoto")}</button>
              </div>
            </div>}
            <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
            <input id="community-gallery" hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
            {photoError ? <small className="inline-error">{t("community.photoError")}</small> : null}
            {posting && photoProgress > 0 ? <progress max="100" value={photoProgress} aria-label={t("community.uploadProgress")} /> : null}
          </div>
          <label htmlFor="community-caption">{t("community.captionLabel")}</label>
          <textarea id="community-caption" value={caption} maxLength={500} placeholder={t("community.captionPlaceholder")} onChange={(event) => setCaption(event.target.value)} />
          <small className="field-hint community-counter">{caption.length}/500</small>
          <span className="community-field-label">{t("community.topicLabel")}</span>
          <div className="community-tags community-create-tags">{COMMUNITY_TAGS.map((entry) => <button type="button" className={tag === entry ? "active" : ""} key={entry} onClick={() => setTag(entry)}>{t(`community.tags.${entry}`)}</button>)}</div>
          <label className="community-check"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /><span>{t("community.adult")}</span></label>
          <p className="sample-note">{t("community.consent")}</p>
          <button type="button" className="community-link" onClick={() => setGuidelinesOpen(true)}>{t("community.guidelinesLink")}</button>
        </div>
        <div className="community-create-footer"><Button wide disabled={posting || !photo || !caption.trim() || !adult} onClick={() => void create()}>{posting ? t("community.posting") : t("community.publish")}</Button></div>
        </div>}
      </Sheet>

      <Sheet open={guidelinesOpen} onClose={() => setGuidelinesOpen(false)} label={t("community.guidelinesTitle")} closeLabel={t("common.close")}>
        <h2>{t("community.guidelinesTitle")}</h2><p>{t("community.guidelinesCopy")}</p><Button wide onClick={() => { setGuidelinesOpen(false); if (!demo) setCreateOpen(true); }}>{t("community.continue")}</Button>
      </Sheet>
    </div>
  );
}
