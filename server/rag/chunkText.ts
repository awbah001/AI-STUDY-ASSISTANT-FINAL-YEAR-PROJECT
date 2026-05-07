/**
 * Split document text into overlapping chunks for embedding and retrieval.
 */
export function chunkText(
  text: string,
  chunkSize: number = 900,
  overlap: number = 120
): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    let slice = cleaned.slice(start, end);
    if (end < cleaned.length) {
      const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
      if (lastBreak > chunkSize * 0.4) {
        slice = slice.slice(0, lastBreak + 1);
      }
    }
    const trimmed = slice.trim();
    if (trimmed.length > 0) chunks.push(trimmed);
    const next = start + slice.length - overlap;
    start = next <= start ? end : next;
  }
  return chunks;
}
