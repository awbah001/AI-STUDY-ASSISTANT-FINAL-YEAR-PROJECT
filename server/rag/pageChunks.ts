import { chunkText } from "./chunkText";

/** Preserve physical PDF pages; a retrieval chunk never invents or crosses a page boundary. */
export function pageChunks(pages: string[], size = 1500, overlap = 200) {
  return pages.flatMap((text, index) =>
    chunkText(text, size, overlap).map(chunk => ({ chunk, page: index + 1 }))
  );
}
