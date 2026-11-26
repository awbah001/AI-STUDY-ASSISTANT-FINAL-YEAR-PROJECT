import { it, expect, vi } from "vitest";
import { embedText } from "./embeddings";
import { retrieveRelevantChunkHits } from "./index";
import { mapConcurrent } from "../../shared/mapConcurrent";
vi.mock("./embeddings", () => ({ embedText: vi.fn(async () => [1, 0]), embedTexts: vi.fn() }));
vi.mock("../settings", () => ({ getRagSettings: vi.fn(async () => ({ topK: 4, similarityThreshold: 0.2 })) }));
vi.mock("./faissFlat", async original => ({
  ...await original<typeof import("./faissFlat")>(),
  loadVectorStore: vi.fn(async () => ({ dim: 2, vectors: [[1, 0]], chunks: ["Supporting passage"] })),
}));
it("reuses one embedding across documents and retains retrieval results", async () => {
  const vector = await embedText("question");
  const results = await Promise.all([1, 2, 3].map(id => retrieveRelevantChunkHits(id, "question", 4, vector)));
  expect(embedText).toHaveBeenCalledTimes(1);
  expect(results.map(hits => hits[0].documentId)).toEqual([1, 2, 3]);
});
it("bounds document work while preserving result order", async () => {
  let active = 0, maximum = 0;
  const result = await mapConcurrent([1, 2, 3, 4, 5], 2, async value => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, value % 2));
    active--;
    return value * 2;
  });
  expect(maximum).toBe(2);
  expect(result).toEqual([2, 4, 6, 8, 10]);
});
