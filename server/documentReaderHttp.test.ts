import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { registerDocumentReaderHttp } from "./documentReaderHttp";
import { requireReaderDocument, readReaderPdf } from "./documentReader";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./settings", () => ({ isMaintenanceMode: vi.fn(async () => false) }));
vi.mock("./documentReader", () => ({
  PDFJS_ROOT: "node_modules/pdfjs-dist",
  requireReaderDocument: vi.fn(),
  readReaderPdf: vi.fn(),
}));
let server: Server;
let base: string;
beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(sdk.authenticateRequest).mockImplementation(async req => {
    if (!req.headers.authorization) throw new Error("No session");
    return {
      id: 3,
      role: req.headers.authorization === "Bearer staff" ? "lecturer" : "user",
    } as any;
  });
  vi.mocked(requireReaderDocument).mockResolvedValue({ id: 12 } as any);
  vi.mocked(readReaderPdf).mockResolvedValue({
    buffer: Buffer.from("%PDF-1.4 fixture"),
    revision: "a".repeat(64),
  });
  const app = express();
  registerDocumentReaderHttp(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(e => (e ? reject(e) : resolve()))
  );
});

describe("reader PDF delivery", () => {
  it("serves a credential-free shell with a validated embedding origin allowlist", async () => {
    const previous = process.env.READER_PARENT_ORIGINS;
    process.env.READER_PARENT_ORIGINS = "https://web.example, javascript:alert(1)";
    try {
      const res = await fetch(base + "/learning-reader?documentId=12");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'self' https://web.example;");
      expect(res.headers.get("content-security-policy")).not.toContain("javascript:");
      expect(await res.text()).not.toContain("Bearer");
      expect(sdk.authenticateRequest).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.READER_PARENT_ORIGINS;
      else process.env.READER_PARENT_ORIGINS = previous;
    }
  });
  it("does not read file bytes without a student session", async () => {
    expect((await fetch(base + "/api/document-reader/12/file")).status).toBe(
      401
    );
    expect(
      (
        await fetch(base + "/api/document-reader/12/file", {
          headers: { Authorization: "Bearer staff" },
        })
      ).status
    ).toBe(403);
    expect(readReaderPdf).not.toHaveBeenCalled();
  });
  it("returns authorized PDF bytes without shared caching", async () => {
    const res = await fetch(base + "/api/document-reader/12/file", {
      headers: { Authorization: "Bearer student" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-type")).toContain("application/pdf");
    expect(res.headers.get("x-document-revision")).toBe("a".repeat(64));
    expect(await res.text()).toContain("%PDF-");
  });
  it("does not leak bytes for a forbidden document or invalid ID", async () => {
    vi.mocked(requireReaderDocument).mockRejectedValue(
      new TRPCError({ code: "NOT_FOUND" })
    );
    expect(
      (
        await fetch(base + "/api/document-reader/99/file", {
          headers: { Authorization: "Bearer student" },
        })
      ).status
    ).toBe(404);
    expect(
      (
        await fetch(base + "/api/document-reader/not-an-id/file", {
          headers: { Authorization: "Bearer student" },
        })
      ).status
    ).toBe(400);
    expect(readReaderPdf).not.toHaveBeenCalled();
  });
});
