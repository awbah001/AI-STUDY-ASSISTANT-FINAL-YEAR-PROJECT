import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import * as SecureStore from "expo-secure-store";
import type { AppRouter } from "../types/router";

export { type AppRouter };

export const trpc = createTRPCReact<AppRouter>();

// Server URL — set via EXPO_PUBLIC_API_URL in mobile/.env
export const API_URL =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
  "http://10.0.2.2:3000";

// ── Token helpers ─────────────────────────────────────────────────────────────
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

// ── tRPC client ───────────────────────────────────────────────────────────────
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
