import { Linking } from "react-native";
import { API_URL, getToken } from "./api";

export async function accessibleFileUrl(value: string): Promise<string> {
  const base = new URL(API_URL);
  const url = new URL(value, base);
  if (url.origin !== base.origin || !url.pathname.startsWith("/uploads/")) return url.href;
  const token = await getToken();
  if (!token) throw new Error("Sign in to open this file.");
  const response = await fetch(`${API_URL}/api/storage/access`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: url.pathname }),
  });
  if (!response.ok) throw new Error("This file is unavailable. Check your access and try again.");
  const result = await response.json();
  return new URL(result.url, base).href;
}

export async function openFileUrl(value: string) {
  return Linking.openURL(await accessibleFileUrl(value));
}
