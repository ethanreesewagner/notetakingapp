"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, RotateCw, CheckCircle2 } from "lucide-react";
import type { Flashcard } from "../../lib/apiClient";
import { reviewCard, isDue, previewInterval, type Grade } from "../../lib/srs";

const GRADES: { grade: Grade; label: string; className: string }[] = [
  { grade: "again", label: "Again", className: "again" },
  { grade: "hard", label: "Hard", className: "hard" },
  { grade: "good", label: "Good", className: "good" },
  { grade: "easy", label: "Easy", className: "easy" },
];

export default function StudySession({
  cards,
  onReview,
  onExit,
}: {
  cards: Flashcard[];
  onReview: (cardId: string, srs: Pick<Flashcard, "dueAt" | "interval" | "ease" | "reps" | "lapses">) => void;
  onExit: () => void;
}) {
  // Build the initial queue: cards due now, or all cards if nothing is due.
  const { initialQueue, reviewingAll } = useMemo(() => {
    const now = Date.now();
    const due = cards.filter((c) => isDue(c, now));
    return due.length > 0
      ? { initialQueue: due, reviewingAll: false }
      : { initialQueue: [...cards], reviewingAll: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [queue, setQueue] = useState<Flashcard[]>(initialQueue);
  const [pos, setPos] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const total = initialQueue.length;
  const card = queue[pos];

  const grade = (g: Grade) => {
    if (!card) return;
    const now = Date.now();
    const next = reviewCard(card, g, now);
    onReview(card.id, next);
    setReviewedCount((n) => n + 1);

    // "Again" re-queues the card later in this session.
    setQueue((prev) => {
      const copy = [...prev];
      if (g === "again") {
        const [c] = copy.splice(pos, 1);
        copy.push({ ...c, ...next });
      }
      return copy;
    });

    setShowBack(false);
    setPos((p) => (g === "again" ? p : p + 1));
  };

  if (total === 0) {
    return (
      <div className="fc-empty-state">
        <p>This deck has no cards yet.</p>
        <button className="fc-btn" onClick={onExit}>
          <ArrowLeft size={15} /> Back
        </button>
      </div>
    );
  }

  if (!card || pos >= queue.length) {
    return (
      <div className="fc-study-done">
        <CheckCircle2 size={40} className="fc-done-check" />
        <h3>Session complete</h3>
        <p>You reviewed {reviewedCount} card{reviewedCount === 1 ? "" : "s"}.</p>
        <button className="fc-btn primary" onClick={onExit}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="fc-study">
      <div className="fc-study-bar">
        <button className="fc-btn ghost" onClick={onExit}>
          <ArrowLeft size={15} /> Back
        </button>
        <span className="fc-study-progress">
          {Math.min(pos + 1, total)} / {total}
          {reviewingAll && <span className="fc-study-note"> · reviewing all</span>}
        </span>
        <span style={{ width: 60 }} />
      </div>

      <button
        className={`fc-card ${showBack ? "flipped" : ""}`}
        onClick={() => setShowBack((v) => !v)}
        aria-label="Flip card"
      >
        <div className="fc-card-inner">
          <div className="fc-card-face fc-card-front">
            <span className="fc-card-hint">Question</span>
            <div className="fc-card-text">{card.front}</div>
            <span className="fc-flip-hint">
              <RotateCw size={13} /> tap to flip
            </span>
          </div>
          <div className="fc-card-face fc-card-back">
            <span className="fc-card-hint">Answer</span>
            <div className="fc-card-text">{card.back || "—"}</div>
          </div>
        </div>
      </button>

      {showBack ? (
        <div className="fc-grades">
          {GRADES.map(({ grade: g, label, className }) => (
            <button key={g} className={`fc-grade ${className}`} onClick={() => grade(g)}>
              <span className="fc-grade-label">{label}</span>
              <span className="fc-grade-when">{previewInterval(card, g)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button className="fc-btn primary fc-show-btn" onClick={() => setShowBack(true)}>
          Show answer
        </button>
      )}
    </div>
  );
}
