import { Capacitor } from "@capacitor/core";

/**
 * Base URL for API requests.
 * - Web: empty string (same origin)
 * - Native: VITE_API_URL, or platform defaults for local dev server
 */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured?.trim()) {
    return configured.trim().replace(/\/$/, "");
  }

  if (Capacitor.isNativePlatform()) {
    // Android emulator: 10.0.2.2 = host machine localhost
    if (Capacitor.getPlatform() === "android") {
      return "http://10.0.2.2:3000";
    }
    // iOS simulator / device on same machine
    return "http://localhost:3000";
  }

  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}
