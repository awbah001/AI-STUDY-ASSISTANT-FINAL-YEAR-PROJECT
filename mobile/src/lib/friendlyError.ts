const NETWORK_RE = /network|fetch|econnrefused|timeout|resolve/i;

/**
 * tRPC surfaces zod validation failures as a JSON array in `message`.
 * Turn that (and transport failures) into a sentence a person can act on.
 */
export function friendlyError(message: string | undefined, fallback: string) {
  const raw = (message ?? "").trim();
  if (!raw) return fallback;
  if (NETWORK_RE.test(raw)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      const issues = Array.isArray(parsed) ? parsed : [parsed];
      const first = issues.find(i => typeof i?.message === "string");
      if (first) {
        const field = Array.isArray(first.path) ? first.path[0] : undefined;
        if (field === "email") return "Enter a valid email address.";
        return first.message;
      }
    } catch {
      return fallback;
    }
  }
  return raw;
}

export function isNetworkError(message: string | undefined) {
  return NETWORK_RE.test(message ?? "");
}
