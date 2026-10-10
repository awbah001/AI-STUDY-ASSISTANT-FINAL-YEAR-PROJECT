import { pipeline } from "@xenova/transformers";
import { ENV } from "./_core/env";

let asr:
  | ((
      audio: Float32Array,
      options?: { sampling_rate?: number }
    ) => Promise<{ text?: string } | string>)
  | null = null;

function decodeWavPcm(buffer: Buffer): { samples: Float32Array; sampleRate: number } {
  if (buffer.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Not a WAV file");
  }
  let offset = 12;
  let sampleRate = 16000;
  let channels = 1;
  let bits = 16;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = buffer.readUInt16LE(offset + 10) || 1;
      sampleRate = buffer.readUInt32LE(offset + 12) || 16000;
      bits = buffer.readUInt16LE(offset + 22) || 16;
    } else if (id === "data") {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset < 0) throw new Error("WAV has no audio data");
  const bytesPerSample = Math.max(1, bits / 8);
  const frameCount = Math.floor(dataSize / (bytesPerSample * channels));
  const samples = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let mix = 0;
    for (let c = 0; c < channels; c++) {
      const idx = dataOffset + (i * channels + c) * bytesPerSample;
      mix += bits === 16 ? buffer.readInt16LE(idx) / 32768 : buffer[idx] / 128 - 1;
    }
    samples[i] = mix / channels;
  }
  return { samples, sampleRate };
}

async function transcribeWithWhisper(buffer: Buffer): Promise<string> {
  const { samples, sampleRate } = decodeWavPcm(buffer);
  if (!asr) {
    asr = (await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en")) as unknown as typeof asr;
  }
  if (!asr) throw new Error("Whisper model failed to load");
  const result = await asr(samples, { sampling_rate: sampleRate });
  const text = (typeof result === "string" ? result : result.text ?? "").trim();
  if (!text) throw new Error("Empty transcription");
  return text;
}

const GROQ_AUDIO_EXTENSIONS: Array<[string, string]> = [
  ["wav", "wav"],
  ["webm", "webm"],
  ["ogg", "ogg"],
  ["m4a", "m4a"],
  ["mp4", "m4a"],
  ["aac", "m4a"],
  ["mpeg", "mp3"],
  ["mp3", "mp3"],
  ["flac", "flac"],
];

/** Groq-hosted Whisper; accepts compressed formats (m4a, webm, ogg) that the local model cannot decode. */
async function transcribeWithGroq(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = GROQ_AUDIO_EXTENSIONS.find(([key]) => mimeType.includes(key))?.[1] ?? "wav";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), `speech.${ext}`);
  form.append("model", ENV.groqSttModel);
  form.append("language", "en");
  form.append("response_format", "json");
  const response = await fetch(`${ENV.groqBaseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.groqApiKey}` },
    body: form,
    signal: AbortSignal.timeout(ENV.groqTimeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Groq transcription failed (${response.status})`);
  }
  const payload = (await response.json()) as { text?: string };
  const text = payload.text?.trim() ?? "";
  return /[a-z0-9]/i.test(text) ? text : "";
}

export async function transcribeStudentAudio(audioBase64: string, mimeType = "audio/wav"): Promise<string> {
  const buffer = Buffer.from(audioBase64, "base64");
  if (buffer.length < 64) throw new Error("Recording was too short.");
  const isWav = mimeType.includes("wav") || buffer.toString("ascii", 0, 4) === "RIFF";

  if (ENV.groqApiKey) {
    let text: string | null = null;
    try {
      text = await transcribeWithGroq(buffer, isWav ? "audio/wav" : mimeType);
    } catch (error) {
      console.warn("[voice] Groq transcription failed, trying local model", error);
      if (!isWav) throw new Error("Could not convert speech to text. Try again, or type your question.");
    }
    if (text !== null) {
      if (!text) throw new Error("No speech detected. Please speak closer to the microphone and try again.");
      return text;
    }
  }
  if (isWav) return transcribeWithWhisper(buffer);
  throw new Error("Could not transcribe that recording. Try again, or type your question.");
}
