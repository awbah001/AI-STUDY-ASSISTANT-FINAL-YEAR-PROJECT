import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { HttpError } from "../../shared/_core/errors";
import { UPLOADS_ROOT, resolveUploadPath, sanitizeUploadKey } from "./uploads";
import { transcribeStudentAudio } from "../voice";

function assertJwtSecret() {
  if ((ENV.cookieSecret ?? "").length < 16) {
    throw new Error("JWT_SECRET must be set to at least 16 characters.");
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  assertJwtSecret();
  const app = express();
  const server = createServer(app);

  // CORS — allow mobile app (ngrok tunnel, LAN, Capacitor, or production domain)
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Local storage fallback (no external S3/Forge required)
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  app.use("/uploads", express.static(UPLOADS_ROOT));
  app.post("/api/storage/put", express.raw({ type: "*/*", limit: "60mb" }), async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.isBanned) {
        res.status(403).json({ error: "Account is banned" });
        return;
      }
      const requestedKey = String(req.query.key ?? "");
      if (!requestedKey) {
        res.status(400).json({ error: "Missing key" });
        return;
      }
      const key = sanitizeUploadKey(user.id, requestedKey);
      const filePath = resolveUploadPath(key);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, req.body);
      res.json({ url: `/uploads/${key}`, key });
    } catch (e) {
      if (e instanceof HttpError) {
        const isBan = e.message === "Account is banned";
        const status = isBan ? 403 : e.statusCode === 403 ? 401 : e.statusCode;
        res.status(status).json({ error: e.message });
        return;
      }
      const message = e instanceof Error ? e.message : "Upload failed";
      const status = message === "File type not allowed" || message === "Invalid upload path" ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/voice/transcribe", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.isBanned) {
        res.status(403).json({ error: "Account is banned" });
        return;
      }
      const audioBase64 = String(req.body?.audioBase64 ?? "");
      const mimeType = String(req.body?.mimeType ?? "audio/wav");
      if (!audioBase64) {
        res.status(400).json({ error: "Missing audio" });
        return;
      }
      const text = await transcribeStudentAudio(audioBase64, mimeType);
      res.json({ text });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode === 403 ? 401 : error.statusCode).json({ error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : "Transcription failed";
      res.status(400).json({ error: message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Mobile/LAN: use http://<your-pc-ip>:${port} as VITE_API_URL when building the app`);
  });
}

startServer().catch(console.error);
