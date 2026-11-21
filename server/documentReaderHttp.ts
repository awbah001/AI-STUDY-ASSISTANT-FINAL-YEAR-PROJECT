import express, { type Express } from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { sdk } from "./_core/sdk";
import {
  PDFJS_ROOT,
  requireReaderDocument,
  readReaderPdf,
} from "./documentReader";
import { isMaintenanceMode } from "./settings";

export function registerDocumentReaderHttp(app: Express) {
  // Public package assets contain no user data. Serve locally, never via a third-party CDN.
  app.use(
    "/api/document-reader/assets",
    express.static(PDFJS_ROOT, { dotfiles: "deny", index: false })
  );
  app.get("/api/document-reader/:id/file", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Sign in again to open this document." });
        return;
      }
      if (user.role !== "user" || (await isMaintenanceMode())) {
        res
          .status(403)
          .json({ error: "The reader is unavailable for this account." });
        return;
      }
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) {
        res.status(400).json({ error: "Invalid document." });
        return;
      }
      const doc = await requireReaderDocument(user, id);
      const { buffer, revision } = await readReaderPdf(doc);
      res.setHeader("X-Document-Revision", revision);
      res.type("application/pdf").send(buffer);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? error.code : "";
      res
        .status(code === "NOT_FOUND" || code === "ENOENT" ? 404 : 400)
        .json({
          error:
            "The PDF could not be opened. Check access or upload a readable copy.",
        });
    }
  });
  // Explicit route works in production and Vite; public shell contains no credentials.
  app.get(["/learning-reader", "/reader/index.html"], (_req, res) => {
    const parentOrigins = (process.env.READER_PARENT_ORIGINS ?? "").split(",").flatMap(value => {
      try {
        const url = new URL(value.trim());
        return ["https:", "http:"].includes(url.protocol) ? [url.origin] : [];
      } catch { return []; }
    });
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'self' ${parentOrigins.join(" ")}; object-src 'none'; base-uri 'none'`
    );
    const built = path.resolve(process.cwd(), "dist/public/reader/index.html");
    res.sendFile(
      process.env.NODE_ENV === "production" && existsSync(built)
        ? built
        : path.resolve(process.cwd(), "client/public/reader/index.html")
    );
  });
}
