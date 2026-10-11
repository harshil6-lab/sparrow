import { useCallback, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { LearnArt } from "../../components/scenes/LearnArt";
import { Sheet } from "../../components/ui/Sheet";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthProvider";
import type { FactCard } from "../../lib/learn";
import { hasCitableSource, visibleNote } from "../../lib/learn";
import { ClipPlayerSheet } from "./learn/ClipPlayerSheet";
import { WatchSection } from "./learn/WatchSection";
import { LEARN_CLIPS, nextClips, normalizeFactId, type LearnClip } from "./learn/clips";
import "../../styles/learn-video.css";

/**
 * Learn tab. Cards come from data/facts.json in the export's
 * Habit -> Better habit -> Why -> Source format; the "Watch" section on top
 * lists the clips from data/learn-clips.json.
 *
 * A card with no cited source shows a "source pending" chip and no link.
 */
export function LearnTab({
  facts,
  savedNotes,
  onOpen,
  onWatch,
}: {
  facts: FactCard[];
  savedNotes: string[];
  onOpen: (cardId: string) => void;
  /** Legacy hook: opens the shared clip sheet for cards without a manifest clip. */
  onWatch?: (cardId: string) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [clip, setClip] = useState<LearnClip | null>(null);
  const [cellular, setCellular] = useState(false);

  const openClip = useCallback(async (next: LearnClip) => {
    let wifiOnly = false;
    if (profile) {
      try {
        wifiOnly = (await api.data.getSettings(profile.user)).wifiOnly;
      } catch {
        wifiOnly = false;
      }
    }
    const connection = (navigator as Navigator & { connection?: { type?: string } }).connection;
    setCellular(wifiOnly && connection?.type === "cellular");
    setClip(next);
  }, [profile]);

  const closePlayer = () => setClip(null);
  const related = clip ? facts.find((card) => normalizeFactId(card.id) === normalizeFactId(clip.factId)) : undefined;

  const open = (cardId: string) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(cardId);
    }
  };

  const watchCard = (cardId: string) => {
    const match = LEARN_CLIPS.find((entry) => normalizeFactId(entry.factId) === normalizeFactId(cardId));
    if (match) void openClip(match);
    else onWatch?.(cardId);
  };

  return (
    <div className="page learn-page">
      <div className="page-heading">
        <span>{t("learn.eyebrow")}</span>
        <h1>{t("learn.title")}</h1>
        <p>{t("learn.copy")}</p>
      </div>

      <WatchSection clips={LEARN_CLIPS} onPlay={(next) => void openClip(next)} />

      {facts.length === 0 ? (
        <div className="empty-state">
          <SparrowMascot pose="curious" size={70} />
          <div>
            <strong>{t("learn.emptyTitle")}</strong>
            <span>{t("learn.emptyCopy")}</span>
          </div>
        </div>
      ) : (
        <div className="habit-grid">
          {facts.map((card) => {
            const hasSource = hasCitableSource(card);
            const why = visibleNote(t(card.why), hasSource);
            return (
              <article
                key={card.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(card.id)}
                onKeyDown={open(card.id)}
              >
                <LearnArt type={card.icon} />
                <div className="habit-top">
                  <Icon name={card.icon} />
                  <span>{t(`learn.${card.id}.category`)}</span>
                  {savedNotes.includes(card.id) ? <Icon name="check" size={16} /> : null}
                </div>
                <dl>
                  <div>
                    <dt>{t("learn.habit")}</dt>
                    <dd>{t(card.habit)}</dd>
                  </div>
                  <div className="better">
                    <dt>{t("learn.betterHabit")}</dt>
                    <dd>{t(card.better_habit)}</dd>
                  </div>
                  {why ? (
                    <div>
                      <dt>{t("learn.why")}</dt>
                      <dd>{why}</dd>
                    </div>
                  ) : null}
                  {hasSource ? card.claims?.map((claim) => (
                    <div key={claim.text}>
                      <dt>
                        <span className={claim.kind === "estimate" ? "source-chip" : undefined}>
                          {claim.kind === "estimate" ? t("learn.estimate") : t("learn.fact")}
                        </span>
                      </dt>
                      <dd>{t(claim.text)}</dd>
                    </div>
                  )) : null}
                </dl>
                {hasSource ? (
                  <small className="source-line">
                    {card.sources.map((source) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
                        {t("learn.sourceLabel")}: {source.publisher}
                      </a>
                    ))}
                  </small>
                ) : (
                  <small className="source-line">
                    <span className="source-chip">{t("common.sourcePending")}</span>
                  </small>
                )}
                <button
                  type="button"
                  className="watch-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    watchCard(card.id);
                  }}
                >
                  {t("learn.watch")}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {savedNotes.length === 0 ? (
        <div className="empty-state">
          <SparrowMascot pose="curious" size={70} />
          <div>
            <strong>{t("learn.noNotesTitle")}</strong>
            <span>{t("learn.noNotesCopy")}</span>
          </div>
        </div>
      ) : null}

      <Sheet open={Boolean(clip)} onClose={closePlayer} label={t("learn.playerTitle")} closeLabel={t("common.close")}>
        <ClipPlayerSheet
          clip={clip}
          cellular={cellular}
          upNext={clip ? nextClips(clip.id) : []}
          relatedId={related?.id ?? null}
          onClose={closePlayer}
          onRelated={(cardId) => {
            setClip(null);
            onOpen(cardId);
          }}
          onPlayClip={(next) => void openClip(next)}
        />
      </Sheet>
    </div>
  );
}