// A lightweight SM-2-style spaced-repetition scheduler. Pure functions so it
// can run on the client (during a study session) or the server.

export interface CardSrs {
  dueAt: number; // ms epoch; 0 = brand new (treated as due now)
  interval: number; // days until next review
  ease: number; // ease factor (min 1.3)
  reps: number; // successful reps in a row
  lapses: number; // times forgotten
}

export type Grade = "again" | "hard" | "good" | "easy";

const DAY = 86_400_000;

export function initialSrs(): CardSrs {
  return { dueAt: 0, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

// Compute the next SRS state after grading a review at time `now`.
export function reviewCard(srs: CardSrs, grade: Grade, now: number): CardSrs {
  let { interval, ease, reps, lapses } = srs;

  if (grade === "again") {
    // Forgot it — relearn soon and drop the ease a little.
    return {
      dueAt: now + 60_000,
      interval: 0,
      ease: Math.max(1.3, ease - 0.2),
      reps: 0,
      lapses: lapses + 1,
    };
  }

  if (grade === "hard") {
    ease = Math.max(1.3, ease - 0.15);
    interval = reps === 0 ? 1 : Math.max(1, interval * 1.2);
  } else if (grade === "good") {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 3;
    else interval = interval * ease;
  } else {
    // easy
    ease = ease + 0.15;
    interval = reps === 0 ? 2 : interval * ease * 1.3;
  }

  interval = Math.max(1, Math.round(interval));
  return { dueAt: now + interval * DAY, interval, ease, reps: reps + 1, lapses };
}

export function isDue(srs: Pick<CardSrs, "dueAt">, now: number): boolean {
  return (srs.dueAt ?? 0) <= now;
}

// Human-friendly "next due" hint for a grade button.
export function previewInterval(srs: CardSrs, grade: Grade): string {
  const next = reviewCard(srs, grade, 0);
  if (grade === "again") return "<1m";
  if (next.interval < 1) return "<1d";
  if (next.interval === 1) return "1d";
  if (next.interval < 30) return `${next.interval}d`;
  const months = Math.round(next.interval / 30);
  return months < 12 ? `${months}mo` : `${Math.round(next.interval / 365)}y`;
}
