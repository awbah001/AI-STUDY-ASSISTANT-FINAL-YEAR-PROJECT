/**
 * update-mobile-url.mjs
 *
 * Reads the active ngrok tunnel URL and writes it to mobile/.env
 * Run this AFTER starting ngrok manually.
 *
 * Usage:
 *   node update-mobile-url.mjs
 */

import { writeFileSync } from "fs";

try {
  const res = await fetch("http://127.0.0.1:4040/api/tunnels");
  const data = await res.json();
  const tunnel = data.tunnels?.find((t) => t.proto === "https");

  if (!tunnel) {
    console.error("❌ No active ngrok HTTPS tunnel found.");
    console.error("   Start ngrok first: ngrok http 3000");
    process.exit(1);
  }

  const url = tunnel.public_url;

  writeFileSync(
    "mobile/.env",
    `# Auto-generated — run: node update-mobile-url.mjs to refresh\nEXPO_PUBLIC_API_URL=${url}\n`,
    "utf-8"
  );

  console.log("✅ mobile/.env updated:");
  console.log("   EXPO_PUBLIC_API_URL =", url);
  console.log("\nPress r in Metro to reload the app.");
} catch {
  console.error("❌ Could not read ngrok API at http://127.0.0.1:4040");
  console.error("   Make sure ngrok is running: ngrok http 3000");
}
