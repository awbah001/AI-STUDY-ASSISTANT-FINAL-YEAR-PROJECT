/**
 * FAISS-style flat inner-product index (normalized vectors = cosine similarity).
 * Persists chunk texts and embedding vectors for retrieval.
 *
 * Optimizations applied:
 *  - In-memory LRU cache (avoids JSON file reads on every query)
 *  - Retrieval score threshold (filters irrelevant chunks)
 */
import fs from "fs/promises";
import path from "path";

export type FaissFlatStore = {
  dim: number;
  chunks: string[];
  /** L2-normalized embedding rows */
  vectors: number[][];
};

// ── In-memory cache ───────────────────────────────────────────────────────────
const MAX_CACHE_SIZE = 50; // max documents cached in memory
const vectorStoreCache = new Map<number, FaissFlatStore>();

function evictOldestIfNeeded() {
  if (vectorStoreCache.size >= MAX_CACHE_SIZE) {
    const oldest = vectorStoreCache.keys().next().value;
    if (oldest !== undefined) vectorStoreCache.delete(oldest);
  }
}

/** Remove a document's vector store from the in-memory cache (call on delete). */
export function evictVectorStoreCache(documentId: number): void {
  vectorStoreCache.delete(documentId);
}

// ─────────────────────────────────────────────────────────────────────────────

export function l2Normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const n = Math.sqrt(sum) || 1;
  return v.map((x) => x / n);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Search the flat index.
 * @param threshold Minimum cosine similarity score (0.0–1.0). Default 0.20.
 *                  Chunks below this score are considered irrelevant and dropped.
 */
export function searchFaissFlat(
  queryVector: number[],
  store: FaissFlatStore,
  topK: number,
  threshold = 0.20
): { chunk: string; score: number }[] {
  const q = l2Normalize(queryVector);
  const scored = store.vectors
    .map((row, i) => ({ chunk: store.chunks[i]!, score: dot(q, row) }))
    .filter((r) => r.score >= threshold); // drop irrelevant chunks
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function vectorStorePath(documentId: number): string {
  const root = path.resolve(process.cwd(), "data", "vectorstores");
  return path.join(root, `doc-${documentId}.json`);
}

export async function loadVectorStore(documentId: number): Promise<FaissFlatStore | null> {
  // Return from memory cache first
  if (vectorStoreCache.has(documentId)) {
    return vectorStoreCache.get(documentId)!;
  }

  const file = vectorStorePath(documentId);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const store = JSON.parse(raw) as FaissFlatStore;
    evictOldestIfNeeded();
    vectorStoreCache.set(documentId, store);
    return store;
  } catch {
    return null;
  }
}

export async function saveVectorStore(documentId: number, store: FaissFlatStore): Promise<void> {
  // Update memory cache immediately so next query is instant
  evictOldestIfNeeded();
  vectorStoreCache.set(documentId, store);

  const file = vectorStorePath(documentId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(store), "utf-8");
}
