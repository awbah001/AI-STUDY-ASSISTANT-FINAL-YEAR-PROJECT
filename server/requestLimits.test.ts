import { describe, it, expect, vi } from "vitest";
import { RequestLimiter, apiRequestLimit } from "./_core/requestLimits";
import { getSystemSettings } from "./settings";
import type { Request, Response } from "express";
vi.mock("./settings", () => ({ getSystemSettings: vi.fn() }));

describe("request limits", () => {
  it("isolates clients and releases a client when its window expires", () => {
    const limiter = new RequestLimiter();
    expect(limiter.take("a", 1, 1000, 0)).toBe(0);
    expect(limiter.take("a", 1, 1000, 500)).toBe(1);
    expect(limiter.take("b", 1, 1000, 500)).toBe(0);
    expect(limiter.take("a", 1, 1000, 1000)).toBe(0);
  });
  it("enforces the administrator's API setting and returns Retry-After", async () => {
    vi.mocked(getSystemSettings).mockResolvedValue({ api: { rateLimitPerMinute: 1 } } as any);
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();
    const req = { ip: "setting-test", path: "/trpc/test", socket: {} } as Request;
    await apiRequestLimit(req, res, next);
    await apiRequestLimit(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(Number));
  });
  it("keeps upload protection active when the global setting is off", async () => {
    vi.mocked(getSystemSettings).mockResolvedValue({ api: { rateLimitPerMinute: 0 } } as any);
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();
    const req = { ip: "upload-test", path: "/storage/put", socket: {} } as Request;
    for (let i = 0; i < 21; i++) {
      req.url = i % 2 ? "/STORAGE/PUT/" : "/storage/put";
      await apiRequestLimit({ ...req, path: req.url } as Request, res, next);
    }
    expect(next).toHaveBeenCalledTimes(20);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
