import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { API_URL, getToken } from "./api";

/** Lets the user pick a square photo and uploads it to storage. Returns the public URL, or null if cancelled. */
export async function pickAndUploadAvatar(userId: number | undefined): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Allow access to your photo library to change your profile picture.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
  const mimeType = asset.mimeType ?? (ext === "png" ? "image/png" : "image/jpeg");
  const key = `avatars/${userId ?? "me"}-${Date.now()}.${ext}`;

  const token = await getToken();
  // expo-file-system v18+ (SDK 57) exposes the File class; bytes() avoids base64 round-trips.
  const { File: FSFile } = await import("expo-file-system");
  const bytes = await new FSFile(asset.uri).bytes();

  const uploadRes = await fetch(`${API_URL}/api/storage/put?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: bytes,
  });
  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`Server error ${uploadRes.status}${errText ? `: ${errText}` : ""}`);
  }
  const { url } = (await uploadRes.json()) as { url: string };
  return url;
}

export function resolveAvatarUri(avatarUrl: string) {
  return avatarUrl.startsWith("/") ? `${API_URL}${avatarUrl}` : avatarUrl;
}
