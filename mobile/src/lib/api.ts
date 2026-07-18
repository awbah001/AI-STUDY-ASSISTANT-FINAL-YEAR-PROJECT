/**
 * tRPC client for the Cognify backend.
 *
 * The API_URL should point to your running server.
 * For local dev on Android emulator: http://10.0.2.2:5000
 * For local dev on iOS simulator:    http://localhost:5000
 * For a physical device on the same Wi-Fi, use your PC's LAN IP.
 * For production: your deployed server URL.
 */

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import * as SecureStore from "expo-secure-store";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:5000";

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

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
