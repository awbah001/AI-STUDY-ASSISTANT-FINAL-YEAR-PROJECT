import officeParser, { type OfficeContentNode, type OfficeAttachment } from "officeparser";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { documentPreviewKind } from "../shared/documentPreview";
import { readDocumentBuffer } from "./llmUtils";

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// OfficeParser 6.1 misses inlineStr cells because its type matcher only accepts
// lowercase letters. Normalize those values to string cells before parsing.
function normalizeSpreadsheet(buffer: Buffer): Buffer {
  const files = unzipSync(buffer);
  for (const path of Object.keys(files)) {
    if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path)) continue;
    const xml = new DOMParser().parseFromString(strFromU8(files[path]), "application/xml");
    const cells = xml.getElementsByTagNameNS("*", "c");
    let changed = false;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells.item(i)!;
      if (cell.getAttribute("t") !== "inlineStr") continue;
      const inline = cell.getElementsByTagNameNS("*", "is").item(0);
      if (!inline) continue;
      const runs = inline.getElementsByTagNameNS("*", "t");
      let text = "";
      for (let j = 0; j < runs.length; j++) text += runs.item(j)?.textContent ?? "";
      const value = xml.createElementNS(cell.namespaceURI, "v");
      value.appendChild(xml.createTextNode(text));
      cell.replaceChild(value, inline);
      cell.setAttribute("t", "str");
      changed = true;
    }
    if (changed) files[path] = strToU8(new XMLSerializer().serializeToString(xml));
  }
  return Buffer.from(zipSync(files));
}

// Render only known elements and validated styles. Document content never becomes executable HTML.
export function renderOfficeContent(nodes: OfficeContentNode[], attachments: OfficeAttachment[] = []): string {
  function render(node: OfficeContentNode): string {
    const metadata = node.metadata;
    const body = node.children?.length ? node.children.map(render).join("") : escape(node.text ?? "");
    const format = node.formatting;
    const styles: string[] = [];
    const alignment = format?.alignment ?? (metadata && "alignment" in metadata ? metadata.alignment : undefined);
    if (alignment && ["left", "right", "center", "justify"].includes(alignment)) styles.push(`text-align:${alignment}`);
    if (format?.bold) styles.push("font-weight:bold");
    if (format?.italic) styles.push("font-style:italic");
    if (format?.underline) styles.push("text-decoration:underline");
    if (format?.color && /^#[a-f\d]{6}$/i.test(format.color)) styles.push(`color:${format.color}`);
    if (format?.backgroundColor && /^#[a-f\d]{6}$/i.test(format.backgroundColor)) styles.push(`background-color:${format.backgroundColor}`);
    if (format?.font && /^[\w -]+$/.test(format.font)) styles.push(`font-family:'${format.font}'`);
    if (format?.size && /^\d+(\.\d+)?(pt|px|em|in|cm)$/.test(format.size)) styles.push(`font-size:${format.size}`);
    const style = styles.length ? ` style="${styles.join(";")}"` : "";
    const element = (tag: string, content = body) => `<${tag}${style}>${content}</${tag}>`;
    switch (node.type) {
      case "text": return element(format?.superscript ? "sup" : format?.subscript ? "sub" : "span");
      case "heading": {
        const level = metadata && "level" in metadata ? metadata.level : 2;
        return element(`h${Math.min(6, Math.max(1, Number(level) || 2))}`);
      }
      case "paragraph": return element("p", body || "<br>");
      case "table": return `<div class="table-scroll"><table>${body}</table></div>`;
      case "row": return element("tr");
      case "cell": return element("td");
      case "list": {
        const ordered = metadata && "listType" in metadata && metadata.listType === "ordered";
        const index = metadata && "index" in metadata ? Number(metadata.index) : 0;
        return `<${ordered ? "ol" : "ul"}${ordered ? ` start="${Number.isFinite(index) ? index + 1 : 1}"` : ""}><li${style}>${body}</li></${ordered ? "ol" : "ul"}>`;
      }
      case "slide": return `<section class="slide"><header>Slide ${metadata && "slideNumber" in metadata ? escape(String(metadata.slideNumber)) : ""}</header>${body}</section>`;
      case "sheet": return `<section class="sheet"><h2>${metadata && "sheetName" in metadata ? escape(metadata.sheetName) : "Worksheet"}</h2><div class="table-scroll"><table>${body}</table></div></section>`;
      case "page": return `<section class="page">${body}</section>`;
      case "image": {
        const attachment = attachments.find(a => metadata && "attachmentName" in metadata && a.name === metadata.attachmentName);
        if (attachment && /^image\/(png|jpeg|gif|webp|bmp)$/.test(attachment.mimeType) && /^[a-zA-Z0-9+/=\r\n]+$/.test(attachment.data)) {
          return `<img src="data:${attachment.mimeType};base64,${attachment.data}" alt="${escape(metadata && "altText" in metadata ? metadata.altText ?? "" : "")}">`;
        }
        return body ? element("p") : "";
      }
      default: return element("div");
    }
  }
  return nodes.map(render).join("");
}

export function previewHtml(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escape(title)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f1f5f4;color:#172b29;font:16px/1.65 Arial,sans-serif}main{max-width:900px;margin:20px auto;background:white;padding:40px;min-height:calc(100vh - 40px);box-shadow:0 2px 12px #0001}p{white-space:pre-wrap;margin:0 0 1em}h1,h2,h3,h4,h5,h6{line-height:1.3}img{max-width:100%;height:auto}table{border-collapse:collapse;min-width:100%}td{border:1px solid #ccd8d4;padding:8px;vertical-align:top;min-width:80px}td p{margin:0}.table-scroll{overflow:auto;margin:16px 0}header{color:#64746f;font-size:13px;margin-bottom:16px}.slide,.sheet,.page{padding:24px;margin-bottom:24px;border:1px solid #d6e2dd;border-radius:8px}.slide{min-height:300px}pre{white-space:pre-wrap;overflow-wrap:anywhere} @media(max-width:600px){main{margin:0;padding:18px}.slide,.sheet,.page{padding:12px}}
  </style></head><body><main>${body}</main></body></html>`;
}

export async function createDocumentPreview(doc: { fileUrl: string; fileName: string; title: string; mimeType?: string | null }) {
  const kind = documentPreviewKind(doc);
  if (kind === "pdf" || kind === "image") return { kind, html: "" };
  if (kind === "unsupported") throw new Error("This format cannot be previewed. For older DOC, PPT, or XLS files, save a copy as DOCX, PPTX, XLSX, or PDF and upload it again.");
  const buffer = await readDocumentBuffer(doc.fileUrl);
  if (!buffer.length) throw new Error("The uploaded file is empty.");
  if (kind === "text") return { kind, html: previewHtml(doc.title, `<pre>${escape(buffer.toString("utf8").replace(/^\uFEFF/, ""))}</pre>`) };
  try {
    const ast = await officeParser.parseOffice(doc.fileName.toLowerCase().endsWith(".xlsx") ? normalizeSpreadsheet(buffer) : buffer, { extractAttachments: true });
    const body = renderOfficeContent(ast.content, ast.attachments);
    if (!body.trim()) throw new Error("No readable content was found.");
    return { kind, html: previewHtml(doc.title, body) };
  } catch (cause) {
    throw new Error("Could not preview this document. It may be damaged or password-protected. Try exporting a new copy and uploading again.", { cause });
  }
}
