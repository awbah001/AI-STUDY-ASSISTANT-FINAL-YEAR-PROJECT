/**
 * tRPC client for the Cognify backend.
 *
 * API_URL points to your running server:
 *   Android emulator : http://10.0.2.2:5000
 *   iOS simulator    : http://localhost:5000
 *   Physical device  : http://<your-pc-lan-ip>:5000
 *   Production       : https://your-domain.com
 */

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import * as SecureStore from "expo-secure-store";

// ─── Router type ─────────────────────────────────────────────────────────────
// Import ONLY the type — never the implementation — so no Node.js modules
// get bundled into the React Native app.
import type { AppRouter } from "../types/router";

export { type AppRouter };

// ─── tRPC React client ───────────────────────────────────────────────────────
export const trpc = createTRPCReact<AppRouter>();

export const API_URL =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
  "http://10.0.2.2:5000";

// ─── Token helpers ────────────────────────────────────────────────────────────
const TOKEN_KEY = "cognify_auth_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── Client factory ───────────────────────────────────────────────────────────
export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
