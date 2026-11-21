import { z } from "zod";

export const readerRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(
    r => r.x + r.width <= 1.00001 && r.y + r.height <= 1.00001,
    "Selection must stay inside the page."
  );

export const readerSelectionSchema = z
  .object({
    documentId: z.number().int().positive(),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    page: z.number().int().min(1).max(2000),
    text: z.string().trim().max(12000).default(""),
    rects: z.array(readerRectSchema).max(200).default([]),
    region: readerRectSchema.optional(),
  })
  .refine(
    s => Boolean(s.text || s.region),
    "Select text or a page region first."
  );

export const READER_ACTIONS = [
  "explain",
  "summarize",
  "simplify",
  "notes",
  "flashcards",
  "ask",
] as const;
export type ReaderSelection = z.infer<typeof readerSelectionSchema>;
export type ReaderRect = z.infer<typeof readerRectSchema>;

/** Match PDF text-layer selections despite line breaks and ligature normalization. */
export function compactPdfText(value: string): string {
  return value.normalize("NFKC").replace(/[\s\u200b\u00ad]+/g, "");
}

export function isPageSelection(pageText: string, selected: string): boolean {
  const needle = compactPdfText(selected);
  return needle.length > 0 && compactPdfText(pageText).includes(needle);
}
