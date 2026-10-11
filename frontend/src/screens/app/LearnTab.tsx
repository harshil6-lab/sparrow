import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { LearnArt } from "../../components/scenes/LearnArt";
import type { FactCard } from "../../lib/learn";
import { hasCitableSource, visibleNote } from "../../lib/learn";

/**
 * Learn tab. Cards come from data/facts.json in the export's
 * Habit -> Better habit -> Why -> Source format.
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
  onWatch: (cardId: string) => void;
}) {
  const { t } = useTranslation();

  const open = (cardId: string) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(cardId);
    }
  };

  return (
    <div className="page learn-page">
      <div className="page-heading">
        <span>{t("learn.eyebrow")}</span>
        <h1>{t("learn.title")}</h1>
        <p>{t("learn.copy")}</p>
      </div>

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
                    onWatch(card.id);
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
    </div>
  );
}
