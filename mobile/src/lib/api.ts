import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import * as SecureStore from "expo-secure-store";
import type { AppRouter } from "../types/router";

export { type AppRouter };

export const trpc = createTRPCReact<AppRouter>();

// ─── Server URL (user-configurable) ──────────────────────────────────────────

const SERVER_URL_KEY = "cognify_server_url";
const DEFAULT_URL = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? "http://10.0.2.2:3000";

/** Get the currently configured server URL (falls back to default) */
export async function getServerUrl(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(SERVER_URL_KEY);
    return stored ?? DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

/** Save a new server URL */
export async function saveServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, ""); // remove trailing slash
  await SecureStore.setItemAsync(SERVER_URL_KEY, clean);
}

/** Get the default/fallback URL */
export function getDefaultUrl(): string {
  return DEFAULT_URL;
}

// Expose API_URL as a sync getter that reads from a cached value
// (updated by the login screen before the client is used)
let _cachedUrl: string = DEFAULT_URL;
export function setCachedUrl(url: string) { _cachedUrl = url; }
export const API_URL = DEFAULT_URL; // kept for document preview URL building

// ─── Token helpers ─────────────────────────────────────────────────────────

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

// ─── Client factory — reads server URL dynamically per request ─────────────

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        // URL is resolved async at request time so it always uses the latest
        url: async () => {
          const base = await getServerUrl();
          return `${base}/api/trpc`;
        },
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
