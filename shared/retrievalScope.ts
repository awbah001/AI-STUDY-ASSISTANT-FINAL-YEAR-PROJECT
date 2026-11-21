import { z } from "zod";
import { readerSelectionSchema } from "./documentReader";

export const retrievalScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("selection"), selection: readerSelectionSchema }),
  z.object({
    type: z.literal("document"),
    documentId: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("course"),
    courseId: z.number().int().positive(),
  }),
  z.object({ type: z.literal("enrolled") }),
]);
export type RetrievalScope = z.infer<typeof retrievalScopeSchema>;
export type RetrievalSource = {
  documentId: number;
  documentTitle: string;
  courseId: number | null;
  excerpt: string;
  sourceId: string;
  page?: number;
  revision?: string;
};
export type StoredRetrievalContext = {
  key: string;
  type: RetrievalScope["type"];
  sources: RetrievalSource[];
};
