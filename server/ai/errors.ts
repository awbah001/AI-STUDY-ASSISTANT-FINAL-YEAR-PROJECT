export type ProviderErrorCategory =
  | "configuration"
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "network"
  | "unavailable"
  | "response"
  | "application";

export class ProviderError extends Error {
  readonly category: ProviderErrorCategory;
  readonly provider: string;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(
    message: string,
    opts: {
      category: ProviderErrorCategory;
      provider: string;
      retryable?: boolean;
      statusCode?: number;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "ProviderError";
    this.category = opts.category;
    this.provider = opts.provider;
    this.retryable = opts.retryable ?? false;
    this.statusCode = opts.statusCode;
    if (opts.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof ProviderError) return error.retryable;
  return false;
}

export function classifyHttpProviderError(
  provider: string,
  status: number,
  body: string
): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(`${provider} authentication failed.`, {
      category: "authentication",
      provider,
      retryable: false,
      statusCode: status,
    });
  }
  if (status === 429) {
    return new ProviderError(`${provider} rate limit exceeded.`, {
      category: "rate_limit",
      provider,
      retryable: true,
      statusCode: status,
    });
  }
  if (status >= 500) {
    return new ProviderError(`${provider} is temporarily unavailable.`, {
      category: "unavailable",
      provider,
      retryable: true,
      statusCode: status,
    });
  }
  return new ProviderError(
    `${provider} request failed (${status}).`,
    {
      category: "response",
      provider,
      retryable: false,
      statusCode: status,
      cause: body.slice(0, 200),
    }
  );
}

/** Safe student-facing message — never include keys or raw upstream bodies. */
export function userFacingAiError(error: unknown): string {
  if (error instanceof ProviderError) {
    if (error.category === "rate_limit") {
      return "The AI service is busy right now. Please try again in a moment.";
    }
    if (error.category === "authentication" || error.category === "configuration") {
      return "The AI service is not configured correctly. Please contact an administrator.";
    }
    return "The AI service is temporarily unavailable. Please try again.";
  }
  return "The AI service is temporarily unavailable. Please try again.";
}
