import * as DocumentPicker from "expo-document-picker";
import { API_URL, getToken } from "./api";

export type PickedFile = {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
};

export type UploadedFile = PickedFile & {
  url: string;
  key: string;
};

const STUDY_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

/** Opens the system file picker. Defaults to the study-document types the server accepts. Returns null if cancelled. */
export async function pickFile(types: string[] = STUDY_TYPES): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? 0,
    mimeType: asset.mimeType ?? "application/octet-stream",
  };
}

/** Uploads a local file to `/api/storage/put` and returns its public URL and storage key. */
export async function uploadFile(file: PickedFile, folder = "uploads"): Promise<UploadedFile> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const key = `${folder}/${Date.now()}-${safeName}`;
  const token = await getToken();
  const { File: FSFile } = await import("expo-file-system");
  const bytes = await new FSFile(file.uri).bytes();

  const res = await fetch(`${API_URL}/api/storage/put?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "Content-Type": file.mimeType,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: bytes,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status})${errText ? `: ${errText}` : ""}`);
  }
  const body = (await res.json()) as { url: string; key?: string };
  return { ...file, url: body.url, key: body.key ?? key };
}

/** Resolves server-relative file URLs (e.g. `/uploads/...`) against the API host. */
export function resolveFileUrl(url: string) {
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}
