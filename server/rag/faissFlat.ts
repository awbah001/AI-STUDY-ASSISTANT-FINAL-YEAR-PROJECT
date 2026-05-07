/**
 * FAISS-style flat inner-product index (normalized vectors = cosine similarity).
 * Persists chunk texts and embedding vectors for retrieval.
 */
import fs from "fs/promises";
import path from "path";

export type FaissFlatStore = {
  dim: number;
  chunks: string[];
  /** L2-normalized embedding rows */
  vectors: number[][];
};

function l2Normalize(v: number[]): number[] {
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

export function searchFaissFlat(
  queryVector: number[],
  store: FaissFlatStore,
  topK: number
): { chunk: string; score: number }[] {
  const q = l2Normalize(queryVector);
  const scored = store.vectors.map((row, i) => ({
    chunk: store.chunks[i]!,
    score: dot(q, row),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function vectorStorePath(documentId: number): string {
  const root = path.resolve(process.cwd(), "data", "vectorstores");
  return path.join(root, `doc-${documentId}.json`);
}

export async function loadVectorStore(documentId: number): Promise<FaissFlatStore | null> {
  const file = vectorStorePath(documentId);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as FaissFlatStore;
  } catch {
    return null;
  }
}

export async function saveVectorStore(documentId: number, store: FaissFlatStore): Promise<void> {
  const file = vectorStorePath(documentId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(store), "utf-8");
}

export { l2Normalize };
