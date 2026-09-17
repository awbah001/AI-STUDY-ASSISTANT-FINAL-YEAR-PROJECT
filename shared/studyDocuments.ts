/** Course/study files the AI can extract text from. */
export const STUDY_DOC_EXTENSIONS = ["pdf", "docx", "pptx"] as const;

export const STUDY_DOC_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const STUDY_DOC_ACCEPT = [
  ".pdf",
  ".docx",
  ".pptx",
  ...STUDY_DOC_MIMES,
].join(",");

export const STUDY_DOC_HELP = "PDF, Word (.docx), or PowerPoint (.pptx) — max 60 MB";

export const STUDY_DOC_ERROR =
  "Only PDF, Word (.docx), and PowerPoint (.pptx) files can be uploaded. The AI cannot read other formats.";

export function getStudyFileExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function studyFormatLabel(type?: string | null, fileName?: string): string {
  const ext = fileName ? getStudyFileExtension(fileName) : "";
  const key = (type || ext || "").toLowerCase();
  if (key === "pdf") return "PDF";
  if (key === "docx" || key === "doc" || key === "notes") return "Word (.docx)";
  if (key === "pptx" || key === "ppt" || key === "slides") return "PowerPoint (.pptx)";
  return ext ? ext.toUpperCase() : "Document";
}

export function isAllowedStudyDocument(fileName: string, mimeType?: string | null): boolean {
  const ext = getStudyFileExtension(fileName);
  if (!(STUDY_DOC_EXTENSIONS as readonly string[]).includes(ext)) return false;
  const mime = (mimeType ?? "").toLowerCase().trim();
  if (!mime || mime === "application/octet-stream") return true;
  return (STUDY_DOC_MIMES as readonly string[]).includes(mime);
}
