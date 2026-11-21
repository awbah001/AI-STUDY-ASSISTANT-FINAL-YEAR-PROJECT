import { readFile, mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { chunkText } from "../server/rag/chunkText";
import { pageChunks } from "../server/rag/pageChunks";
import { embedText, embedTexts } from "../server/rag/embeddings";
import {
  l2Normalize,
  searchFaissFlat,
  type FaissFlatStore,
} from "../server/rag/faissFlat";

const label = process.argv[2] ?? "baseline";
const paged = process.argv.includes("--paged");
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Use a simple result label.");
const fixture = JSON.parse(
  await readFile("evals/rag-fixtures.json", "utf8")
) as {
  description: string;
  documents: Array<{
    id: number;
    title: string;
    courseId: number;
    pages: string[];
  }>;
  queries: Array<{ question: string; documentId: number; page: number }>;
};
const started = performance.now();
const stores = new Map<number, FaissFlatStore>();
// Baseline uses the existing production chunker and flat normalized-vector search.
for (const doc of fixture.documents) {
  const located = paged ? pageChunks(doc.pages, 1500, 200) : undefined;
  const chunks = located
    ? located.map(item => item.chunk)
    : chunkText(doc.pages.join("\n\n"), 1500, 200);
  const vectors = (await embedTexts(chunks)).map(l2Normalize);
  stores.set(doc.id, {
    dim: vectors[0].length,
    chunks,
    vectors,
    ...(located
      ? {
          pages: located.map(item => item.page),
          revision: "f".repeat(64),
          schemaVersion: 2 as const,
        }
      : {}),
  });
}
const results = [];
for (const query of fixture.queries) {
  const began = performance.now();
  const vector = await embedText(query.question);
  const hits = fixture.documents
    .flatMap(doc =>
      searchFaissFlat(vector, stores.get(doc.id)!, 3, 0.2).map(h => ({
        documentId: doc.id,
        ...h,
      }))
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  results.push({
    ...query,
    documentHitAt1: hits[0]?.documentId === query.documentId,
    documentHitAt3: hits.some(h => h.documentId === query.documentId),
    ...(paged
      ? {
          pageHitAt1:
            hits[0]?.documentId === query.documentId &&
            hits[0]?.page === query.page,
          pageHitAt3: hits.some(
            h => h.documentId === query.documentId && h.page === query.page
          ),
        }
      : {}),
    latencyMs: Math.round(performance.now() - began),
    hits: hits.map(h => ({
      documentId: h.documentId,
      score: h.score,
      ...(h.page ? { page: h.page } : {}),
    })),
  });
}
const report = {
  label,
  fixture: fixture.description,
  embeddingModel: "Xenova/all-MiniLM-L6-v2",
  method:
    "existing flat cosine search, threshold 0.2, top 3 across fixture documents",
  queries: results.length,
  documentHitRateAt1:
    results.filter(r => r.documentHitAt1).length / results.length,
  documentHitRateAt3:
    results.filter(r => r.documentHitAt3).length / results.length,
  pageHitRateAt1: paged
    ? results.filter(r => r.pageHitAt1).length / results.length
    : null,
  pageCitationCorrectness: paged
    ? "Fixture page ranking is measured; generated-answer citation correctness needs separate review."
    : "Not evaluated: the baseline index has no page coordinates.",
  answerFaithfulness:
    "Not evaluated: no language-model answers were generated.",
  unauthorizedAccess:
    "Validated separately by API and retrieval authorization tests; this fixture measures ranking only.",
  elapsedMs: Math.round(performance.now() - started),
  results,
};
await mkdir("evals/results", { recursive: true });
await writeFile(
  `evals/results/${label}.json`,
  JSON.stringify(report, null, 2) + "\n",
  { flag: "wx" }
);
console.log(
  JSON.stringify({
    label,
    queries: report.queries,
    documentHitRateAt3: report.documentHitRateAt3,
    elapsedMs: report.elapsedMs,
  })
);
