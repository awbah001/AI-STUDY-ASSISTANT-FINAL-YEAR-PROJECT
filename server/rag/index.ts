/**
 * RAG pipeline: index documents and retrieve relevant chunks.
 *
 * Optimizations applied:
 *  - Duplicate chunk removal (Jaccard similarity filter)
 *  - Over-fetching + deduplication for better top-K quality
 *  - Score threshold applied in searchFaissFlat
 */
import { chunkText } from "./chunkText";
import { pageChunks } from "./pageChunks";
import { embedText, embedTexts } from "./embeddings";
import { l2Normalize, loadVectorStore, saveVectorStore, searchFaissFlat, type FaissFlatStore } from "./faissFlat";
import { getRagSettings } from "../settings";

const OVER_FETCH_MULTIPLIER = 2;
const JACCARD_DEDUP_THRESHOLD = 0.6;

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

export async function buildDocumentVectorIndex(documentId: number, fullText: string, source?: { pages?: string[]; revision: string }): Promise<void> {
  const rag = await getRagSettings();
  const located = source?.pages ? pageChunks(source.pages, rag.chunkSize, rag.chunkOverlap) : undefined;
  const chunks = located ? located.map(item => item.chunk) : chunkText(fullText, rag.chunkSize, rag.chunkOverlap);
  if (chunks.length === 0) return;

  console.log(`[RAG] Indexing doc ${documentId}: ${chunks.length} chunks`);

  const vectorsRaw = await embedTexts(chunks);
  const vectors = vectorsRaw.map((v) => l2Normalize(v));
  const dim = vectors[0]?.length ?? 0;
  if (!dim) return;

  const store: FaissFlatStore = { dim, chunks, vectors, ...(source ? { revision: source.revision, schemaVersion: 2 as const } : {}), ...(located ? { pages: located.map(item => item.page) } : {}) };
  await saveVectorStore(documentId, store);

  console.log(`[RAG] Doc ${documentId} indexed successfully (${dim}-dim, ${chunks.length} chunks)`);
}

export type RetrievedChunkHit = {
  documentId: number;
  chunk: string;
  score: number;
  page?: number;
  revision?: string;
};

export async function retrieveRelevantChunkHits(
  documentId: number,
  query: string,
  topK?: number
): Promise<RetrievedChunkHit[]> {
  const rag = await getRagSettings();
  const k = topK ?? rag.topK;
  const store = await loadVectorStore(documentId);
  if (!store || store.chunks.length === 0) return [];

  const qVec = await embedText(query);
  const overFetchK = Math.min(k * OVER_FETCH_MULTIPLIER, store.chunks.length);
  const hits = searchFaissFlat(qVec, store, overFetchK, rag.similarityThreshold);
  if (hits.length === 0) return [];

  const kept: { chunk: string; score: number; page?: number; revision?: string }[] = [];
  for (const hit of hits) {
    if (kept.length >= k) break;
    const isDuplicate = kept.some(
      (k) => jaccardSimilarity(k.chunk, hit.chunk) > JACCARD_DEDUP_THRESHOLD
    );
    if (!isDuplicate) kept.push(hit);
  }

  return kept.map((h) => ({ documentId, ...h }));
}

export async function retrieveRelevantChunks(
  documentId: number,
  query: string,
  topK?: number
): Promise<string> {
  const hits = await retrieveRelevantChunkHits(documentId, query, topK);
  return hits.map((h) => h.chunk).join("\n\n---\n\n");
}
