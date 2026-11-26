import { apiUrl, getApiBaseUrl } from "./apiBaseUrl";
import { getAuthToken } from "./authToken";

export async function accessibleFileUrl(value: string): Promise<string> {
  const url = new URL(value, new URL(getApiBaseUrl() || window.location.origin, window.location.origin));
  const base = new URL(getApiBaseUrl() || window.location.origin, window.location.origin);
  if (url.origin !== base.origin || !url.pathname.startsWith("/uploads/")) return value;
  const response = await fetch(apiUrl("/api/storage/access"), {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken() ?? ""}` },
    body: JSON.stringify({ url: url.pathname }),
  });
  if (!response.ok) throw new Error("This file is unavailable. Check your access and try again.");
  return new URL((await response.json()).url, base).href;
}

export async function openFileUrl(value: string) {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const url = await accessibleFileUrl(value);
    if (tab) tab.location.replace(url);
    else window.location.assign(url);
  } catch (error) { tab?.close(); throw error; }
}
