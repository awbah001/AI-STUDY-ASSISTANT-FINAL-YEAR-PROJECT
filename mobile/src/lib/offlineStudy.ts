import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { OfflineStudyStorage } from "../../../shared/offlineStorage";
import type { OfflineStudyEvent } from "../../../shared/offlineStudy";
import { getAuthSessionKey } from "./authSession";

const OWNER_KEY = "cognify_offline_owner";
const directory = `${FileSystem.documentDirectory ?? ""}offline-study/`;
export const offlineStorage = new OfflineStudyStorage({
  async read(key) {
    if (Platform.OS === "web") return localStorage.getItem(key);
    if (!FileSystem.documentDirectory) throw new Error("Device storage is unavailable.");
    const path = `${directory}${key}.json`;
    for (const candidate of [path, `${path}.backup`]) {
      if (!(await FileSystem.getInfoAsync(candidate)).exists) continue;
      const raw = await FileSystem.readAsStringAsync(candidate);
      try { JSON.parse(raw); return raw; } catch { /* Recover a write interrupted by app termination. */ }
    }
    if ((await FileSystem.getInfoAsync(path)).exists) throw new Error("The saved study data could not be read.");
    return null;
  },
  async write(key, value) {
    if (Platform.OS === "web") { localStorage.setItem(key, value); return; }
    if (!FileSystem.documentDirectory) throw new Error("Device storage is unavailable.");
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const path = `${directory}${key}.json`;
    if ((await FileSystem.getInfoAsync(path)).exists) {
      const previous = await FileSystem.readAsStringAsync(path);
      try { JSON.parse(previous); await FileSystem.writeAsStringAsync(`${path}.backup`, previous); } catch { /* Keep a previously valid backup. */ }
    }
    await FileSystem.writeAsStringAsync(path, value);
  },
});

export async function setOfflineOwner(ownerId: number | null) {
  if (Platform.OS === "web") {
    if (ownerId) localStorage.setItem(OWNER_KEY, String(ownerId)); else localStorage.removeItem(OWNER_KEY);
  } else if (ownerId) await SecureStore.setItemAsync(OWNER_KEY, String(ownerId));
  else await SecureStore.deleteItemAsync(OWNER_KEY);
}
export async function getOfflineOwner(): Promise<number | null> {
  const value = Platform.OS === "web" ? localStorage.getItem(OWNER_KEY) : await SecureStore.getItemAsync(OWNER_KEY);
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const syncing = new Map<number, Promise<{ accepted: string[]; rejected: Array<{ eventId: string; message: string }> }>>();
export function syncOfflineStudy(ownerId: number, send: (input: { ownerId: number; events: OfflineStudyEvent[] }) => Promise<{ accepted: string[]; rejected: Array<{ eventId: string; message: string }> }>) {
  const running = syncing.get(ownerId);
  if (running) return running;
  const job = (async () => {
    if (getAuthSessionKey() !== `user-${ownerId}`) throw new Error("Sign in to this account to sync its progress.");
    const data = await offlineStorage.read(ownerId);
    if (!data.events.length) return { accepted: [], rejected: [] };
    const result = await send({ ownerId, events: data.events.slice(0, 50) });
    await offlineStorage.acknowledge(ownerId, result.accepted);
    return result;
  })().finally(() => syncing.delete(ownerId));
  syncing.set(ownerId, job);
  return job;
}

export function offlineEvent(documentId: number, kind: OfflineStudyEvent["kind"], startedAt: number, extra: Partial<OfflineStudyEvent> = {}): OfflineStudyEvent {
  return { eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`, documentId, kind, occurredAt: Date.now(), minutes: Math.max(1, Math.min(240, Math.round((Date.now() - startedAt) / 60_000))), ...extra };
}
