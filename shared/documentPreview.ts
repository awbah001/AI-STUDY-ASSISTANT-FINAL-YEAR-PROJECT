export type DocumentPreviewKind = "pdf" | "image" | "office" | "text" | "unsupported";

export function documentPreviewKind(doc: { fileName: string; mimeType?: string | null }): DocumentPreviewKind {
  const ext = doc.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["docx", "pptx", "xlsx", "odt", "odp", "ods", "rtf"].includes(ext)) return "office";
  if (["txt", "md", "csv", "tsv"].includes(ext)) return "text";
  // Old binary Office formats require conversion, not a PDF iframe.
  if (["doc", "ppt", "xls"].includes(ext)) return "unsupported";
  if (doc.fileName.includes(".")) return "unsupported";
  const mime = doc.mimeType?.toLowerCase() ?? "";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/")) return "text";
  if (mime.includes("openxmlformats") || mime.includes("opendocument") || mime.includes("rtf")) return "office";
  return "unsupported";
}

export const DOCUMENT_ACCEPT = ".pdf,.docx,.pptx,.xlsx,.odt,.odp,.ods,.rtf,.txt,.md,.csv,.tsv,.png,.jpg,.jpeg,.gif,.webp";
