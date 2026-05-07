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

/**
 * Single text embedding (384-dim for all-MiniLM-L6-v2), L2-normalized.
 */
export async function embedText(text: string): Promise<number[]> {
  const pipe = await getEmbedder();
  const truncated = text.length > 8000 ? text.slice(0, 8000) : text;
  const output = await pipe(truncated, { pooling: "mean", normalize: true });
  const tensorData = output.data;
  return Array.from(tensorData);
}

/**
 * Batch embed strings (sequential; avoids large memory spikes).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    out.push(await embedText(t));
  }
  return out;
}
