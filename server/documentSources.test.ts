import { beforeEach, describe, expect, it, vi } from "vitest";
import { sourceId, withDocumentSources, findDocumentSource } from "./documentSources";
import { loadVectorStore } from "./rag/faissFlat";
vi.mock("./rag/faissFlat", () => ({ loadVectorStore: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe("verified document references", () => {
  it("uses retrieval titles, stable source links, and escaped excerpts", () => {
    const answer = withDocumentSources("Answer", [{ documentId: 2, documentTitle: "Notes](https://evil.example)", chunk: "<script>Do this</script>", score: 0.8 }]);
    expect(answer).toContain(`/document/2?tab=notes&source=${sourceId("<script>Do this</script>")}`);
    expect(answer).not.toContain("[Notes](https://evil.example)");
    expect(answer).toContain("\\<script\\>");
  });
  it("deduplicates references and adds none without retrieved evidence", () => {
    const chunk = { documentId: 2, documentTitle: "Notes", chunk: "Evidence", score: 0.8 };
    expect(withDocumentSources("Answer", [chunk, chunk]).match(/view source excerpt/g)).toHaveLength(1);
    expect(withDocumentSources("General explanation", [])).toBe("General explanation");
  });
  it("only resolves excerpts in the current document, including text fallback", async () => {
    vi.mocked(loadVectorStore).mockResolvedValue({ chunks: ["Indexed evidence"], dim: 1, vectors: [[1]] });
    expect(await findDocumentSource({ id: 2 }, sourceId("Indexed evidence"))).toBe("Indexed evidence");
    expect(await findDocumentSource({ id: 2 }, sourceId("Forged excerpt"))).toBeNull();
    expect(await findDocumentSource({ id: 2, extractedText: "Fallback text" }, sourceId("Fallback text"))).toBe("Fallback text");
  });
});
