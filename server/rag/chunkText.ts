/**
 * Split document text into overlapping chunks for embedding and retrieval.
 *
 * Optimizations applied:
 *  - Increased chunk size from 900 → 1500 chars (more context per chunk)
 *  - Increased overlap from 120 → 200 chars (better continuity)
 *  - Smarter break-point detection (prefers paragraph > sentence > word boundaries)
 */
export function chunkText(
  text: string,
  chunkSize: number = 1500,
  overlap: number = 200
): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    let slice = cleaned.slice(start, end);

    if (end < cleaned.length) {
      // Prefer breaking at: paragraph > sentence end > word boundary
      const paraBreak = slice.lastIndexOf("\n\n");
      const sentBreak = slice.lastIndexOf(". ");
      const wordBreak = slice.lastIndexOf(" ");

      const minBreakPos = chunkSize * 0.4;

      if (paraBreak > minBreakPos) {
        slice = slice.slice(0, paraBreak + 1);
      } else if (sentBreak > minBreakPos) {
        slice = slice.slice(0, sentBreak + 2); // include the period and space
      } else if (wordBreak > minBreakPos) {
        slice = slice.slice(0, wordBreak);
      }
    }

    const trimmed = slice.trim();
    if (trimmed.length > 0) chunks.push(trimmed);

    const next = start + slice.length - overlap;
    start = next <= start ? end : next;
  }

  return chunks;
}
