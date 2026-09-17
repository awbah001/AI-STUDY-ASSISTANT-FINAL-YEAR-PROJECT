/**
 * SM-2 spaced-repetition algorithm.
 *
 * Rating scale (matches Anki's convention, familiar to students):
 *   0 — Again   (complete blackout / wrong, restart interval)
 *   1 — Hard    (correct but very difficult)
 *   2 — Good    (correct with some hesitation)
 *   3 — Easy    (correct, effortless)
 *
 * Reference: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 */

export type Sm2Rating = 0 | 1 | 2 | 3;

export interface Sm2State {
  easeFactor: number;   // starts at 2.5, min 1.3
  srInterval: number;   // days until next review (0 = new)
  repetitions: number;  // consecutive correct reviews
  dueDate: Date | null; // null means due immediately
}

export interface Sm2Result extends Sm2State {
  dueDate: Date;
}

/**
 * Apply one SM-2 review and return the updated state.
 *
 * @param current  Current card state (from DB)
 * @param rating   Student's self-assessment: 0=Again 1=Hard 2=Good 3=Easy
 * @param now      Reference time (defaults to Date.now())
 */
export function applySm2(
  current: Sm2State,
  rating: Sm2Rating,
  now: Date = new Date()
): Sm2Result {
  let { easeFactor, srInterval, repetitions } = current;

  if (rating === 0) {
    // Again — reset to beginning, but keep ease factor punishment
    repetitions = 0;
    srInterval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    // Correct response (1=Hard, 2=Good, 3=Easy)
    if (repetitions === 0) {
      srInterval = 1;
    } else if (repetitions === 1) {
      srInterval = 6;
    } else {
      srInterval = Math.round(srInterval * easeFactor);
    }

    repetitions += 1;

    // Adjust ease factor based on rating quality
    // Formula: EF' = EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))
    // where q = 0..3 mapped from our rating
    const q = rating; // 1=Hard, 2=Good, 3=Easy already in 0..3 range
    easeFactor = easeFactor + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));
    easeFactor = Math.max(1.3, parseFloat(easeFactor.toFixed(4)));
  }

  // Cap interval to 365 days
  srInterval = Math.min(srInterval, 365);

  const dueDate = new Date(now.getTime() + srInterval * 24 * 60 * 60 * 1000);

  return { easeFactor, srInterval, repetitions, dueDate };
}

/**
 * Returns true if the card is due for review right now.
 */
export function isDueNow(card: Sm2State, now: Date = new Date()): boolean {
  if (!card.dueDate) return true;          // never reviewed = always due
  return card.dueDate.getTime() <= now.getTime();
}
