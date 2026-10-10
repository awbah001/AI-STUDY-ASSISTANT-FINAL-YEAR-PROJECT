import type { AiMetricsSnapshot } from "./types";

type Bucket = {
  requests: number;
  successes: number;
  failures: number;
  totalLatencyMs: number;
};

const bucket: Bucket = {
  requests: 0,
  successes: 0,
  failures: 0,
  totalLatencyMs: 0,
};

export function recordAiAttempt(ok: boolean, latencyMs: number) {
  bucket.requests += 1;
  if (ok) {
    bucket.successes += 1;
    bucket.totalLatencyMs += latencyMs;
  } else {
    bucket.failures += 1;
  }
}

export function getAiMetrics(): AiMetricsSnapshot {
  return {
    provider: "groq",
    requests: bucket.requests,
    successes: bucket.successes,
    failures: bucket.failures,
    averageLatencyMs:
      bucket.successes > 0 ? Math.round(bucket.totalLatencyMs / bucket.successes) : null,
    successRate:
      bucket.requests > 0 ? Math.round((bucket.successes / bucket.requests) * 1000) / 10 : null,
  };
}

export function resetAiMetrics() {
  bucket.requests = 0;
  bucket.successes = 0;
  bucket.failures = 0;
  bucket.totalLatencyMs = 0;
}
