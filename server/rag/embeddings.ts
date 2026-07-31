/**
 * Text embedding using Xenova/all-MiniLM-L6-v2 (384 dimensions).
 *
 * Optimizations applied:
 *  - LRU embedding cache (avoids re-embedding identical text)
 *  - Parallel batch processing in groups of 16
 */
import { pipeline } from "@xenova/transformers";

type Embedder = (
  text: string,
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array }>;

let embedder: Embedder | null = null;

async function getEmbedder(): Promise<Embedder> {
  if (!embedder) {
    embedder = (await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    )) as Embedder;
  }
  return embedder;
}

// ── LRU embedding cache ───────────────────────────────────────────────────────
const MAX_EMBED_CACHE = 500;
const embeddingCache = new Map<string, number[]>();

function getCacheKey(text: string): string {
  // Use first 200 chars as key — good enough for query deduplication
  return text.slice(0, 200).trim();
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single text embedding (384-dim), L2-normalized.
 * Results are cached to avoid re-embedding duplicate queries.
 */
export async function embedText(text: string): Promise<number[]> {
  const key = getCacheKey(text);
  if (embeddingCache.has(key)) return embeddingCache.get(key)!;

  const pipe = await getEmbedder();
  const truncated = text.length > 8000 ? text.slice(0, 8000) : text;
  const output = await pipe(truncated, { pooling: "mean", normalize: true });
  const result = Array.from(output.data) as number[];

  // Evict oldest entry if cache is full
  if (embeddingCache.size >= MAX_EMBED_CACHE) {
    embeddingCache.delete(embeddingCache.keys().next().value!);
  }
  embeddingCache.set(key, result);
  return result;
}

/**
 * Batch embed strings in parallel groups of 16.
 * Significantly faster than sequential processing for large documents.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 16;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(embedText));
    results.push(...batchResults);
  }

  return results;
}
