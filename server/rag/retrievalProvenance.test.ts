import { describe, expect, it, vi } from "vitest";
import { retrieveRelevantChunkHits } from "./index";
import { loadVectorStore } from "./faissFlat";

vi.mock("./embeddings", () => ({ embedText: vi.fn(async () => [1, 0]) }));
vi.mock("../settings", () => ({
  getRagSettings: vi.fn(async () => ({ topK: 3, similarityThreshold: 0.2 })),
}));
vi.mock("./faissFlat", async importOriginal => ({
  ...(await importOriginal<typeof import("./faissFlat")>()),
  loadVectorStore: vi.fn(),
}));

describe("retrieval provenance through deduplication", () => {
  it("retains physical page and file revision in the returned evidence", async () => {
    vi.mocked(loadVectorStore).mockResolvedValue({
      dim: 2,
      chunks: [
        "Photosynthesis converts light energy",
        "Photosynthesis converts light energy",
      ],
      vectors: [
        [1, 0],
        [1, 0],
      ],
      pages: [3, 4],
      revision: "a".repeat(64),
      schemaVersion: 2,
    });
    expect(await retrieveRelevantChunkHits(91, "photosynthesis")).toEqual([
      {
        documentId: 91,
        chunk: "Photosynthesis converts light energy",
        score: 1,
        page: 3,
        revision: "a".repeat(64),
      },
    ]);
  });
  it("keeps the legacy evidence shape when provenance is unavailable", async () => {
    vi.mocked(loadVectorStore).mockResolvedValue({
      dim: 2,
      chunks: ["Legacy"],
      vectors: [[1, 0]],
    });
    expect(await retrieveRelevantChunkHits(92, "legacy")).toEqual([
      { documentId: 92, chunk: "Legacy", score: 1 },
    ]);
  });
});
