/**
 * Lightweight per-user AI rate limiter (in-memory).
 * Configurable via AI_RATE_LIMIT_PER_MINUTE (default 30).
 */
const hits = new Map<number, { count: number; windowStart: number }>();

const WINDOW_MS = 60_000;

export function getAiRateLimitPerMinute(): number {
  const raw = Number(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "30");
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.floor(raw);
}

export function assertAiRateLimit(userId: number): void {
  const limit = getAiRateLimitPerMinute();
  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(userId, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) {
    const err = new Error(
      `AI rate limit exceeded. Please wait a moment before trying again (max ${limit}/min).`
    );
    (err as Error & { code?: string }).code = "TOO_MANY_REQUESTS";
    throw err;
  }
}
