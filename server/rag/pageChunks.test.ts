import { describe, it, expect } from "vitest";
import { pageChunks } from "./pageChunks";
import { searchFaissFlat } from "./faissFlat";
describe("page provenance", () => {
  it("keeps physical page numbers across blank pages and long-page splits", () => {
    const chunks = pageChunks(
      ["First page", "", "Third page ".repeat(200)],
      200,
      30
    );
    expect(chunks[0].page).toBe(1);
    expect(chunks.slice(1).every(c => c.page === 3)).toBe(true);
    expect(
      chunks.some(
        c => c.chunk.includes("First page") && c.chunk.includes("Third page")
      )
    ).toBe(false);
  });
  it("returns verified page metadata only when it exists and retains legacy compatibility", () => {
    const base = {
      dim: 2,
      chunks: ["First", "Second"],
      vectors: [
        [1, 0],
        [0, 1],
      ],
    };
    expect(searchFaissFlat([1, 0], base, 1)).toEqual([
      { chunk: "First", score: 1 },
    ]);
    expect(
      searchFaissFlat(
        [0, 1],
        { ...base, pages: [1, 4], revision: "a".repeat(64) },
        1
      )[0]
    ).toMatchObject({ chunk: "Second", page: 4, revision: "a".repeat(64) });
  });
});
