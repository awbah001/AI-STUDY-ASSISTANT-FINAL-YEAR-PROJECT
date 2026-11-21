# Scoped retrieval evaluation

`rag-fixtures.json` contains self-authored synthetic biology, networking and database notes. Fixture page numbers and publication/enrollment scenarios simulate course materials. They are not real participant records, university-approved evaluation findings or evidence of learning improvement.

The baseline was recorded before changing the chunker. It uses MiniLM-L6-v2 embeddings already cached locally, the existing 1,500-character / 200-character-overlap chunker, cosine threshold 0.2 and flat search. `results/baseline.json` is retained unchanged. `results/page-aware.json` uses the same text and model with chunks confined to physical fixture pages. Each output label is written once to preserve prior results.

Reproduce with fresh labels:

```sh
node --import tsx scripts/evaluate-rag.ts baseline-repeat
node --import tsx scripts/evaluate-rag.ts page-aware-repeat --paged
```

Both runs find the expected document at rank one for all nine questions (the original report includes raw ranked hits from which baseline rank-one accuracy can be computed). The page-aware run also finds the expected fixture page at rank one for all nine questions. This is a small regression fixture, not a statistically representative quality benchmark. Three documents make top-three document recall a weak metric. Run-to-run latency is machine-dependent and is not evidence of a performance improvement.

Separate automated tests cover cross-course exclusion, denied scopes before retrieval, revoked enrollment, changed source bytes, legacy index rejection, missing evidence, forged evidence IDs, history isolation, prompt boundaries and additive migration. Real PDF tests check that parsed physical pages match the synthetic PDF fixture. Those tests validate access/provenance and response structure; they do not establish semantic faithfulness of arbitrary model answers.

Before release, assemble a lecturer-reviewed dataset from the intended courses with consent and appropriate anonymization. For each question, record allowed course IDs, relevant document revisions, expected pages/excerpts and an answer rubric. Include unanswerable questions, cross-course canaries, ambiguous follow-ups, stale resources and injected instructions. Record retrieval relevance, citation correctness, answer faithfulness, course relevance, unsupported-claim frequency and latency. Have reviewers inspect each generated claim against its cited excerpt. Missing values must remain explicitly unmeasured; do not substitute ranking or citation-format checks for academic correctness.
