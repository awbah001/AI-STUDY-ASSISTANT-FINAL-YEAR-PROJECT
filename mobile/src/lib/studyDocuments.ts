function fileExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function studyFormatLabel(type?: string | null, fileName?: string): string {
  const ext = fileName ? fileExtension(fileName) : "";
  const key = (type || ext || "").toLowerCase();
  if (key === "pdf") return "PDF";
  if (key === "docx" || key === "doc" || key === "notes") return "Word (.docx)";
  if (key === "pptx" || key === "ppt" || key === "slides") return "PowerPoint (.pptx)";
  return ext ? ext.toUpperCase() : "Document";
}
