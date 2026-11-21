export const RECAP_WORDS_PER_MINUTE = 156;

/** Longer uploads receive more explanation, with a bounded listening time. */
export function recapLengthForDocument(text: string) {
  const sourceWords = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.min(
    12,
    6 + Math.ceil(Math.max(0, sourceWords - 3000) / 3000)
  );
  return {
    minutes,
    minWords: minutes * RECAP_WORDS_PER_MINUTE,
    maxWords: minutes * RECAP_WORDS_PER_MINUTE + 120,
  };
}

/** Keep device speech below its input limit without dropping any text. */
export function splitRecapSpeech(text: string, maxChars = 3500): string[] {
  const limit = Math.max(1, Math.floor(maxChars));
  const parts: string[] = [];
  let remaining = text.trim();
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const sentenceEnd = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! ")
    );
    const wordEnd = window.lastIndexOf(" ");
    const end =
      sentenceEnd >= limit / 2
        ? sentenceEnd + 1
        : wordEnd > 0
          ? wordEnd
          : limit;
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}
