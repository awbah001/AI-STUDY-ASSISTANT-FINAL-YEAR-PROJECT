import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import officeParser from "officeparser";
import pdfParse from "pdf-parse";
import { extractDocumentText } from "./llmUtils";

vi.mock("fs/promises", () => ({ default: { readFile: vi.fn() } }));
vi.mock("pdf-parse", () => ({ default: vi.fn() }));
vi.mock("./rag/index", () => ({
  buildDocumentVectorIndex: vi.fn(), retrieveRelevantChunks: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function upload(content: string) {
  vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(content));
  return extractDocumentText("/uploads/extraction-test");
}

describe("document text extraction", () => {
  it("extracts real OfficeParser v6 output without calling the PDF parser", async () => {
    const text = await upload("{\\rtf1\\ansi Course material for students.}");
    expect(text).toContain("Course material for students.");
    expect(pdfParse).not.toHaveBeenCalled();
  });

  it("does not send invalid non-PDF content to the PDF parser", async () => {
    vi.spyOn(officeParser, "parseOffice").mockRejectedValue(new Error("Unsupported file"));
    await expect(upload("not an office document")).rejects.toThrow("unsupported format");
    expect(pdfParse).not.toHaveBeenCalled();
  });

  it("falls back to the PDF parser for PDF bytes", async () => {
    vi.spyOn(officeParser, "parseOffice").mockRejectedValue(new Error("Primary parser failed"));
    vi.mocked(pdfParse).mockResolvedValue({ text: "  PDF material  " } as Awaited<ReturnType<typeof pdfParse>>);
    await expect(upload("%PDF-1.7\nfixture")).resolves.toBe("PDF material");
    expect(pdfParse).toHaveBeenCalledOnce();
  });

  it("reports malformed PDFs with the original error as cause", async () => {
    vi.spyOn(officeParser, "parseOffice").mockRejectedValue(new Error("Primary parser failed"));
    const cause = new Error("Invalid PDF structure");
    vi.mocked(pdfParse).mockRejectedValue(cause);
    await expect(upload("%PDF-1.7\ninvalid")).rejects.toMatchObject({
      message: expect.stringContaining("Could not read this PDF"), cause,
    });
  });

  it("explains when a PDF has no selectable text", async () => {
    vi.spyOn(officeParser, "parseOffice").mockResolvedValue({ toText: () => "" } as Awaited<ReturnType<typeof officeParser.parseOffice>>);
    vi.mocked(pdfParse).mockResolvedValue({ text: " " } as Awaited<ReturnType<typeof pdfParse>>);
    await expect(upload("%PDF-1.7\nscan")).rejects.toThrow("use OCR");
  });

  it("rejects empty uploads before invoking either parser", async () => {
    const office = vi.spyOn(officeParser, "parseOffice");
    await expect(upload("")).rejects.toThrow("uploaded file is empty");
    expect(office).not.toHaveBeenCalled();
    expect(pdfParse).not.toHaveBeenCalled();
  });
});
