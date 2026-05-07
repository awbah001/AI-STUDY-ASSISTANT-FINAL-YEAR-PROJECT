/**
 * Client-side storage helper for uploading files to S3
 * Uses the built-in Manus storage API
 */

const STORAGE_API_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL;
const STORAGE_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;

export async function storagePut(
  key: string,
  data: Uint8Array | ArrayBuffer | string,
  contentType: string = "application/octet-stream"
): Promise<{ url: string; key: string }> {
  // Fallback to local server storage when Forge/S3 is not configured.
  if (!STORAGE_API_URL || !STORAGE_API_KEY) {
    const blobData = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    const bodyBytes =
      blobData instanceof Uint8Array
        ? blobData
        : new TextEncoder().encode(String(blobData));
    // Copy to ensure an `ArrayBuffer`-backed view for TS/DOM types.
    const bodyCopy = new Uint8Array(bodyBytes);
    const response = await fetch(`/api/storage/put?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: new Blob([bodyCopy as unknown as BlobPart], { type: contentType }),
    });

    if (!response.ok) {
      throw new Error(`Local storage upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      url: result.url,
      key: result.key,
    };
  }

  const formData = new FormData();
  formData.append("key", key);
  const blobData = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  formData.append("file", new Blob([blobData as any], { type: contentType }));

  const response = await fetch(`${STORAGE_API_URL}/storage/put`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STORAGE_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    url: result.url,
    key: result.key,
  };
}

export async function storageGet(
  key: string,
  expiresIn: number = 3600
): Promise<{ url: string; key: string }> {
  if (!STORAGE_API_URL || !STORAGE_API_KEY) {
    throw new Error("Storage API not configured");
  }

  const response = await fetch(`${STORAGE_API_URL}/storage/get`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STORAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key, expiresIn }),
  });

  if (!response.ok) {
    throw new Error(`Storage get failed: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    url: result.url,
    key: result.key,
  };
}
