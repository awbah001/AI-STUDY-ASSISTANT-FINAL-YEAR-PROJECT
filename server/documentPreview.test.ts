import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import { zipSync, strToU8 } from "fflate";
import type { OfficeContentNode } from "officeparser";
import { createDocumentPreview, renderOfficeContent, previewHtml } from "./documentPreview";
import { documentPreviewKind } from "../shared/documentPreview";

vi.mock("fs/promises", () => ({ default: { readFile: vi.fn() } }));
vi.mock("./rag/index", () => ({ buildDocumentVectorIndex: vi.fn(), retrieveRelevantChunks: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const doc = { fileName: "notes.rtf", fileUrl: "/uploads/notes.rtf", title: "Notes" };

describe("document previews", () => {
  it.each(["docx", "pptx", "xlsx", "odt", "odp", "ods", "rtf"])("recognizes %s even with an incorrect PDF MIME", ext => {
    expect(documentPreviewKind({ fileName: `notes.${ext}`, mimeType: "application/pdf" })).toBe("office");
  });
  it.each(["txt", "md", "csv", "tsv"])("recognizes readable %s documents", ext => {
    expect(documentPreviewKind({ fileName: `notes.${ext}` })).toBe("text");
  });
  it.each(["doc", "ppt", "xls", "zip"])("does not send %s to a PDF viewer", ext => {
    expect(documentPreviewKind({ fileName: `notes.${ext}`, mimeType: "application/pdf" })).toBe("unsupported");
  });
  it.each([
    ["docx", "word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>DOCX course notes</w:t></w:r></w:p></w:body></w:document>', "DOCX course notes"],
    ["pptx", "ppt/slides/slide1.xml", '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>PPTX course slides</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>', "PPTX course slides"],
    ["xlsx", "xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>XLSX course grades</t></is></c></row></sheetData></worksheet>', "XLSX course grades"],
  ])("creates a preview from real %s ZIP bytes", async (ext, path, xml, expected) => {
    const mime = ext === "docx" ? "wordprocessingml.document" : ext === "pptx" ? "presentationml.presentation" : "spreadsheetml.sheet";
    const files = {
      "[Content_Types].xml": strToU8(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.${mime}.main+xml"/></Types>`),
      [path]: strToU8(xml),
    };
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(zipSync(files)));
    const preview = await createDocumentPreview({ ...doc, fileName: `notes.${ext}` });
    expect(preview.html).toContain(expected);
    if (ext === "docx") expect(preview.html).toContain("font-weight:bold");
  });
  it("parses real formatted RTF without stored extracted text", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("{\\rtf1\\ansi Hello \\b students\\b0 .}"));
    const preview = await createDocumentPreview(doc);
    expect(preview.html).toContain("students");
    expect(preview.html).toContain("font-weight:bold");
    expect(preview.kind).toBe("office");
  });
  it("escapes document content and rejects injected styling", () => {
    const html = renderOfficeContent([{ type: "text", text: "<script>alert(1)</script>", formatting: { size: '12px; background:url(https://example.com)' } }]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("url(");
    expect(previewHtml("</title><script>", html)).toContain("default-src 'none'");
  });
  it("preserves headings, tables, slide boundaries and worksheet names", () => {
    const content: OfficeContentNode[] = [
      { type: "heading", text: "Course", metadata: { level: 1 } },
      { type: "slide", metadata: { slideNumber: 2 }, children: [{ type: "paragraph", text: "Slide content" }] },
      { type: "sheet", metadata: { sheetName: "Grades" }, children: [{ type: "row", children: [{ type: "cell", text: "95" }] }] },
    ];
    const html = renderOfficeContent(content);
    expect(html).toContain("<h1>Course</h1>");
    expect(html).toContain("Slide 2");
    expect(html).toContain("<h2>Grades</h2>");
    expect(html).toContain("<table><tr><td>95</td></tr></table>");
  });
  it("renders embedded raster images and refuses SVG content", () => {
    const nodes: OfficeContentNode[] = [{ type: "image", metadata: { attachmentName: "picture", altText: 'An "image"' } }];
    expect(renderOfficeContent(nodes, [{ type: "image", name: "picture", extension: "png", mimeType: "image/png", data: "aGVsbG8=" }])).toContain("data:image/png;base64,aGVsbG8=");
    expect(renderOfficeContent(nodes, [{ type: "image", name: "picture", extension: "svg", mimeType: "image/svg+xml", data: "aGVsbG8=" }])).not.toContain("<img");
  });
  it("renders plain text safely before background extraction completes", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("<img onerror=alert(1)>\nMy notes"));
    const preview = await createDocumentPreview({ ...doc, fileName: "notes.txt" });
    expect(preview.html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(preview.html).toContain("My notes");
  });
  it("offers conversion instructions for legacy Word files", async () => {
    await expect(createDocumentPreview({ ...doc, fileName: "notes.doc" })).rejects.toThrow("save a copy as DOCX");
    expect(fs.readFile).not.toHaveBeenCalled();
  });
  it("leaves PDFs and images to the native viewer", async () => {
    expect(await createDocumentPreview({ ...doc, fileName: "notes.pdf" })).toEqual({ kind: "pdf", html: "" });
    expect(await createDocumentPreview({ ...doc, fileName: "notes.png" })).toEqual({ kind: "image", html: "" });
    expect(fs.readFile).not.toHaveBeenCalled();
  });
});
