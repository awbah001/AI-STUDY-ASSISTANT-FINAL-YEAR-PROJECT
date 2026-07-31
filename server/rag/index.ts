/**
 * RAG pipeline: index documents and retrieve relevant chunks.
 *
 * Optimizations applied:
 *  - Duplicate chunk removal (Jaccard similarity filter)
 *  - Over-fetching + deduplication for better top-K quality
 *  - Score threshold applied in searchFaissFlat
 */
import { chunkText } from "./chunkText";
import { embedText, embedTexts } from "./embeddings";
import { l2Normalize, loadVectorStore, saveVectorStore, searchFaissFlat, type FaissFlatStore } from "./faissFlat";

const DEFAULT_TOP_K = 6;
const OVER_FETCH_MULTIPLIER = 2; // fetch 2× topK, then deduplicate
const JACCARD_DEDUP_THRESHOLD = 0.6; // remove chunks sharing >60% words

/**
 * Compute Jaccard similarity between two text strings (word-level).
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Remove near-duplicate chunks from a ranked list.
 * Keeps the highest-scoring chunk when duplicates are found.
 */
function deduplicateChunks(
  hits: { chunk: string; score: number }[],
  topK: number
): string[] {
  const kept: { chunk: string; score: number }[] = [];

  for (const hit of hits) {
    if (kept.length >= topK) break;
    const isDuplicate = kept.some(
      (k) => jaccardSimilarity(k.chunk, hit.chunk) > JACCARD_DEDUP_THRESHOLD
    );
    if (!isDuplicate) kept.push(hit);
  }

  return kept.map((h) => h.chunk);
}

/**
 * Build and persist a FAISS-style flat index for a document's extracted text.
 */
export async function buildDocumentVectorIndex(documentId: number, fullText: string): Promise<void> {
  const chunks = chunkText(fullText);
  if (chunks.length === 0) return;

  console.log(`[RAG] Indexing doc ${documentId}: ${chunks.length} chunks`);

  const vectorsRaw = await embedTexts(chunks);
  const vectors = vectorsRaw.map((v) => l2Normalize(v));
  const dim = vectors[0]?.length ?? 0;
  if (!dim) return;

  const store: FaissFlatStore = { dim, chunks, vectors };
  await saveVectorStore(documentId, store);

  console.log(`[RAG] Doc ${documentId} indexed successfully (${dim}-dim, ${chunks.length} chunks)`);
}

/**
 * Retrieve top-K relevant text chunks for a query.
 * Applies score threshold, over-fetches, and deduplicates before returning.
 */
export async function retrieveRelevantChunks(
  documentId: number,
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<string> {
  const store = await loadVectorStore(documentId);
  if (!store || store.chunks.length === 0) return "";

  const qVec = await embedText(query);

  // Over-fetch then deduplicate for better quality
  const overFetchK = Math.min(topK * OVER_FETCH_MULTIPLIER, store.chunks.length);
  const hits = searchFaissFlat(qVec, store, overFetchK);

  if (hits.length === 0) return "";

  const deduped = deduplicateChunks(hits, topK);
  return deduped.join("\n\n---\n\n");
}
