import { chunkText } from "./chunkText";
import { embedText, embedTexts } from "./embeddings";
import { l2Normalize, loadVectorStore, saveVectorStore, searchFaissFlat, type FaissFlatStore } from "./faissFlat";

const DEFAULT_TOP_K = 5;

/**
 * Build and persist a FAISS-style flat index for a document's extracted text.
 */
export async function buildDocumentVectorIndex(documentId: number, fullText: string): Promise<void> {
  const chunks = chunkText(fullText);
  if (chunks.length === 0) return;

  const vectorsRaw = await embedTexts(chunks);
  const vectors = vectorsRaw.map((v) => l2Normalize(v));
  const dim = vectors[0]?.length ?? 0;
  if (!dim) return;

  const store: FaissFlatStore = { dim, chunks, vectors };
  await saveVectorStore(documentId, store);
}

/**
 * Retrieve top-K text chunks for a query using embedding similarity.
 */
export async function retrieveRelevantChunks(
  documentId: number,
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<string> {
  const store = await loadVectorStore(documentId);
  if (!store || store.chunks.length === 0) return "";

  const qVec = await embedText(query);
  const hits = searchFaissFlat(qVec, store, topK);
  return hits.map((h) => h.chunk).join("\n\n---\n\n");
}
