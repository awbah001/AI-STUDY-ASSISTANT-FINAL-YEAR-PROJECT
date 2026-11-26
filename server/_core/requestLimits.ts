import { TRPCError } from "@trpc/server";
import type { Request, Response, NextFunction } from "express";
import { getSystemSettings } from "../settings";

/** Process-local protection. Expired entries are pruned and the map is bounded. */
export class RequestLimiter {
  private lastSweep = 0;
  private entries = new Map<string, { count: number; expires: number }>();
  take(key: string, limit: number, windowMs = 60_000, now = Date.now()) {
    if (now - this.lastSweep >= 60_000) {
      for (const [key, entry] of this.entries) if (entry.expires <= now) this.entries.delete(key);
      this.lastSweep = now;
    }
    let entry = this.entries.get(key);
    if (!entry || entry.expires <= now) {
      if (this.entries.size >= 50_000) return Math.ceil(windowMs / 1000);
      entry = { count: 0, expires: now + windowMs };
      this.entries.set(key, entry);
    }
    entry.count++;
    return entry.count > limit ? Math.max(1, Math.ceil((entry.expires - now) / 1000)) : 0;
  }
}

export const requestLimiter = new RequestLimiter();

export function limitAuthAction(action: string, ip: string, account: string) {
  const limit = action === "login" ? 10 : 5;
  const retries = [
    requestLimiter.take(`auth:${action}:ip:${ip}`, limit * 5, 15 * 60_000),
    requestLimiter.take(`auth:${action}:account:${account.toLowerCase()}`, limit, 15 * 60_000),
  ];
  if (retries.some(Boolean)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many attempts. Try again in ${Math.max(...retries)} seconds.` });
}

export async function apiRequestLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getSystemSettings();
    const configured = settings.api.rateLimitPerMinute;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    // Match Express's default case-insensitive, optional-trailing-slash routes.
    const routePath = req.path.toLowerCase().replace(/\/+$/, "");
    const sensitiveLimit = routePath === "/storage/put" ? 20 : routePath === "/voice/transcribe" ? 10 : 0;
    const retry = Math.max(
      configured > 0 ? requestLimiter.take(`api:${ip}`, configured) : 0,
      sensitiveLimit ? requestLimiter.take(`sensitive:${routePath}:${ip}`, sensitiveLimit) : 0,
    );
    if (retry) {
      res.setHeader("Retry-After", retry);
      res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfterSeconds: retry });
      return;
    }
    next();
  } catch (error) { next(error); }
}
