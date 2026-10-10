import { apiUrl } from "@/lib/apiBaseUrl";
import { getAuthToken } from "@/lib/authToken";

const TARGET_SAMPLE_RATE = 16000;

/** Microphone access (and the browser speech API) only work on HTTPS or localhost. */
export function voiceInputBlockedReason(): string | null {
  if (typeof window === "undefined") return "Voice input is not available here.";
  if (!window.isSecureContext) {
    return "Voice input needs a secure connection. Open the site on https:// or http://localhost.";
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return "This browser cannot record audio. Try Chrome, Edge, Safari or Firefox.";
  }
  return null;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** Converts any browser recording to 16 kHz mono WAV, which every server transcriber accepts. */
async function toWav(blob: Blob): Promise<ArrayBuffer> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE);
  } finally {
    void ctx.close();
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function transcribeRecording(blob: Blob): Promise<string> {
  const wav = await toWav(blob);
  const token = getAuthToken();
  const response = await fetch(apiUrl("/api/voice/transcribe"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ audioBase64: toBase64(wav), mimeType: "audio/wav" }),
  });
  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok || !payload.text?.trim()) {
    throw new Error(payload.error || "Could not convert speech to text.");
  }
  return payload.text.trim();
}

export type ActiveRecording = { stop: () => Promise<Blob> };

export async function startRecording(onLimit: () => void, maxMs = 60_000): Promise<ActiveRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };
  });
  recorder.start();
  const timer = setTimeout(onLimit, maxMs);
  return {
    stop: () => {
      clearTimeout(timer);
      if (recorder.state === "recording") recorder.stop();
      return finished;
    },
  };
}
