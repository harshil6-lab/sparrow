import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import type { CommunityComment, CommunityPost } from "../../../lib/api/data";

/**
 * Comment list plus a composer pinned to the bottom of the sheet. The composer
 * uses `dvh` sizing and safe-area padding so the on-screen keyboard cannot hide
 * it. New comments are added optimistically and rolled back on failure.
 */
export function CommentsSheet({ post, onError }: { post: CommunityPost | null; onError: (error: unknown, postId?: string) => void }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!post) {
      setComments([]);
      setText("");
      return;
    }
    let live = true;
    void api.data.community
      .getCommunityComments(post.id)
      .then((result) => {
        if (live) setComments(result.comments);
      })
      .catch((error: unknown) => onError(error, post.id));
    return () => {
      live = false;
    };
  }, [post, onError]);

  if (!post) return null;

  const trimmed = text.trim();
  const remove = (commentId: string) => {
    void api.data.community
      .deleteCommunityComment(post.id, commentId)
      .then(() => setComments((items) => items.filter((item) => item.id !== commentId)))
      .catch((error: unknown) => onError(error, post.id));
  };

  const send = () => {
    if (!trimmed || sending) return;
    setSending(true);
    const pending: CommunityComment = {
      id: "pending-" + Date.now(),
      authorName: t("community.you"),
      text: trimmed,
      createdAt: new Date().toISOString(),
      isMine: true,
    };
    setComments((items) => [...items, pending]);
    setText("");
    void api.data.community
      .addCommunityComment(post.id, trimmed)
      .then((comment) => setComments((items) => items.map((item) => (item.id === pending.id ? comment : item))))
      .catch((error: unknown) => {
        setComments((items) => items.filter((item) => item.id !== pending.id));
        setText((current) => (current ? current : trimmed));
        onError(error, post.id);
      })
      .finally(() => setSending(false));
  };

  return (
    <div className="community-reels community-reels--sheet">
      <div className="community-reels__comments">
        <h2>{t("community.commentsTitle")}</h2>
        {comments.length === 0 ? <p className="community-reels__comments-empty">{t("community.commentsEmpty")}</p> : null}
        <ul className="community-reels__comment-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div>
                <strong>{comment.authorName}</strong>
                <p>{comment.text}</p>
              </div>
              {comment.isMine || post.isMine ? (
                <button type="button" onClick={() => remove(comment.id)}>
                  {t("community.deleteComment")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <form
          className="community-reels__composer"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            type="text"
            value={text}
            maxLength={300}
            aria-label={t("community.addComment")}
            placeholder={t("community.addComment")}
            onChange={(event) => setText(event.target.value)}
          />
          <span className="community-reels__composer-count">{t("community.commentCounter", { count: text.length })}</span>
          <Button type="button" size="sm" disabled={!trimmed || sending} aria-label={t("community.send")} onClick={send}>
            {t("community.send")}
          </Button>
        </form>
      </div>
    </div>
  );
}