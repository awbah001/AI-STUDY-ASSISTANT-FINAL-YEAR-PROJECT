import { beforeEach, describe, expect, it, vi } from "vitest";
import * as queries from "./queries";
import * as llm from "./llmUtils";
import { processDocument, ensureDocumentText } from "./documentAiService";
import type { Document } from "../drizzle/schema";

vi.mock("./queries", () => ({ getDocumentById: vi.fn(), updateDocument: vi.fn(), recordSystemEvent: vi.fn() }));
vi.mock("./llmUtils", () => ({ extractDocumentText: vi.fn(), indexDocumentForRag: vi.fn() }));
let doc: Document;
beforeEach(() => {
  vi.resetAllMocks();
  doc = { id: 2, userId: 5, fileUrl: "/uploads/notes.docx", extractedText: null, processingStatus: "pending" } as Document;
  vi.mocked(queries.getDocumentById).mockImplementation(async () => doc);
  vi.mocked(queries.updateDocument).mockImplementation(async (_id, patch) => { Object.assign(doc, patch); return doc; });
  vi.mocked(llm.extractDocumentText).mockResolvedValue("Course material");
  vi.mocked(llm.indexDocumentForRag).mockResolvedValue();
});
describe("document processing lifecycle", () => {
  it("moves uploads through processing to ready", async () => {
    await processDocument(2);
    expect(doc.processingStatus).toBe("ready");
    expect(doc.extractedText).toBe("Course material");
    expect(llm.indexDocumentForRag).toHaveBeenCalledWith(2, "Course material");
  });
  it("shares a job with simultaneous retry and lazy extraction", async () => {
    await Promise.all([processDocument(2), ensureDocumentText(2), processDocument(2)]);
    expect(llm.extractDocumentText).toHaveBeenCalledOnce();
    expect(llm.indexDocumentForRag).toHaveBeenCalledOnce();
  });
  it("stores actionable extraction errors and allows retry", async () => {
    vi.mocked(llm.extractDocumentText).mockRejectedValueOnce(new Error("Damaged document"));
    await expect(processDocument(2)).rejects.toThrow("Damaged document");
    expect(doc.processingStatus).toBe("failed");
    expect(doc.processingError).toBe("Damaged document");
    await processDocument(2);
    expect(doc.processingStatus).toBe("ready");
    expect(doc.processingError).toBeNull();
  });
  it("retains extracted text when indexing fails, and does not extract again on retry", async () => {
    vi.mocked(llm.indexDocumentForRag).mockRejectedValueOnce(new Error("Embedding service unavailable"));
    await expect(processDocument(2)).rejects.toThrow("Embedding service unavailable");
    expect(doc.extractedText).toBe("Course material");
    expect(doc.processingStatus).toBe("failed");
    await processDocument(2);
    expect(llm.extractDocumentText).toHaveBeenCalledOnce();
    expect(doc.processingStatus).toBe("ready");
  });
  it("respects disabled automatic indexing", async () => {
    await processDocument(2, false);
    expect(doc.processingStatus).toBe("ready");
    expect(llm.indexDocumentForRag).not.toHaveBeenCalled();
  });
});
