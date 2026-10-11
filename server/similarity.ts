/**
 * Word-for-word overlap between submissions, using overlapping 5-word sequences ("shingles").
 * Meaning-based embeddings would flag every answer to the same question, so this only
 * looks for shared wording, which is what a lecturer needs to check by eye.
 */

export const SHINGLE_SIZE = 5;
/** Below this many distinct sequences (about 15 words) a submission is too short to compare. */
export const MIN_SHINGLES = 10;

type Token = { norm: string; raw: string };

export type PreparedText = {
  tokens: Token[];
  /** Sequence key at each word position, in reading order. */
  keys: string[];
  /** Distinct keys, minus anything excluded (such as the assignment brief). */
  set: Set<string>;
};

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)) {
    out.push({ raw: match[0], norm: match[0].toLowerCase().replace(/['’]/g, "") });
  }
  return out;
}

export function shingleKeys(tokens: Token[], size = SHINGLE_SIZE): string[] {
  const keys: string[] = [];
  for (let i = 0; i + size <= tokens.length; i++) {
    keys.push(tokens.slice(i, i + size).map((t) => t.norm).join(" "));
  }
  return keys;
}

export function prepareText(text: string, exclude?: Set<string>): PreparedText {
  const tokens = tokenize(text);
  const keys = shingleKeys(tokens);
  const set = new Set(exclude ? keys.filter((k) => !exclude.has(k)) : keys);
  return { tokens, keys, set };
}

export function isComparable(text: PreparedText) {
  return text.set.size >= MIN_SHINGLES;
}

/** Percent of the shorter text's sequences that also appear in the other. */
export function overlapPercent(a: PreparedText, b: PreparedText): number {
  const [small, large] = a.set.size <= b.set.size ? [a, b] : [b, a];
  if (!small.set.size) return 0;
  let shared = 0;
  for (const key of small.set) if (large.set.has(key)) shared++;
  return Math.round((shared / small.set.size) * 100);
}

/** Percent of `text`'s sequences found in a reference set (for example the course notes). */
export function containmentPercent(text: PreparedText, reference: Set<string>): number {
  if (!text.set.size) return 0;
  let shared = 0;
  for (const key of text.set) if (reference.has(key)) shared++;
  return Math.round((shared / text.set.size) * 100);
}

/** The longest runs of `text` that also appear in `reference`, as readable excerpts. */
export function sharedPassages(text: PreparedText, reference: Set<string>, limit = 3, maxChars = 240): string[] {
  const runs: Array<{ start: number; length: number }> = [];
  let start = -1;
  for (let i = 0; i <= text.keys.length; i++) {
    const hit = i < text.keys.length && text.set.has(text.keys[i]) && reference.has(text.keys[i]);
    if (hit && start < 0) start = i;
    if (!hit && start >= 0) {
      runs.push({ start, length: i - start });
      start = -1;
    }
  }
  return runs
    .sort((x, y) => y.length - x.length || x.start - y.start)
    .slice(0, limit)
    .map(({ start: from, length }) => {
      const words = text.tokens.slice(from, from + length + SHINGLE_SIZE - 1).map((t) => t.raw).join(" ");
      return words.length > maxChars ? `${words.slice(0, maxChars).trimEnd()}…` : words;
    });
}

export type SimilarityPair<T> = { a: T; b: T; percent: number; passages: string[] };

/** Every pair of comparable submissions at or above `minPercent`, most similar first. */
export function comparePairs<T>(
  items: Array<{ item: T; text: PreparedText }>,
  minPercent: number
): Array<SimilarityPair<T>> {
  const usable = items.filter((entry) => isComparable(entry.text));
  const pairs: Array<SimilarityPair<T>> = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const percent = overlapPercent(usable[i].text, usable[j].text);
      if (percent < minPercent) continue;
      pairs.push({
        a: usable[i].item,
        b: usable[j].item,
        percent,
        passages: sharedPassages(usable[i].text, usable[j].text.set),
      });
    }
  }
  return pairs.sort((x, y) => y.percent - x.percent);
}
