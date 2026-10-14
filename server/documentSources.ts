import { createHash } from "crypto";
import { loadVectorStore } from "./rag/faissFlat";
import type { RetrievedChunk } from "./agent/types";

export const sourceId = (chunk: string) => createHash("sha256").update(chunk).digest("hex").slice(0, 24);
const escapeMarkdown = (value: string) => value.replace(/[\\`*_{}[\]()<>#!|]/g, "\\$&").replace(/\s+/g, " ");

/** References come from authorized retrieval, never from model-supplied titles or URLs. */
export function withDocumentSources(answer: string, chunks: RetrievedChunk[]): string {
  const unique = [...new Map(chunks.map(chunk => [`${chunk.documentId}:${sourceId(chunk.chunk)}`, chunk])).values()].slice(0, 6);
  if (!unique.length) return answer;
  const references = unique.map((chunk, index) => {
    const title = escapeMarkdown(chunk.documentTitle || "Document");
    return `${index + 1}. [${title} — view source excerpt](/document/${chunk.documentId}?tab=notes&source=${sourceId(chunk.chunk)})\n\n   > ${escapeMarkdown(chunk.chunk.slice(0, 700))}`;
  });
  return `${answer}\n\n**Material excerpts used**\n\n${references.join("\n\n")}`;
}

export async function findDocumentSource(doc: { id: number; extractedText?: string | null }, id: string): Promise<string | null> {
  const store = await loadVectorStore(doc.id);
  const candidates = [...(store?.chunks ?? []), ...(doc.extractedText?.trim() ? [doc.extractedText.slice(0, 2500)] : [])];
  return candidates.find(chunk => sourceId(chunk) === id)?.slice(0, 700) ?? null;
}
