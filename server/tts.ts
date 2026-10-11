import { ENV } from "./_core/env";

/** Groq Orpheus accepts at most 200 characters per request. */
export const TTS_MAX_CHARS = 190;
const OUTPUT_RATE = 16_000;

/** Split prose into speakable pieces that respect sentence, then clause, then word boundaries. */
export function splitForSpeech(text: string, maxChars = TTS_MAX_CHARS): string[] {
  const clean = text
    .replace(/[*_#`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]*/g) ?? [clean];
  const pieces: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) pieces.push(current.trim());
    current = "";
  };
  const addPart = (part: string) => {
    const p = part.trim();
    if (!p) return;
    if ((current + " " + p).trim().length <= maxChars) {
      current = (current + " " + p).trim();
      return;
    }
    push();
    if (p.length <= maxChars) {
      current = p;
      return;
    }
    let line = "";
    for (const word of p.split(" ")) {
      if ((line + " " + word).trim().length > maxChars) {
        if (line) pieces.push(line.trim());
        line = word.slice(0, maxChars);
      } else {
        line = (line + " " + word).trim();
      }
    }
    current = line;
  };
  for (const sentence of sentences) {
    if (sentence.trim().length <= maxChars) addPart(sentence);
    else sentence.split(/(?<=[,;:])\s+/).forEach(addPart);
  }
  push();
  return pieces;
}

export type PcmAudio = { samples: Int16Array; sampleRate: number };

/** Decode 8/16-bit integer or 32-bit float WAV into mono 16-bit samples. */
export function decodeWav(buffer: Buffer): PcmAudio {
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAV file");
  }
  let offset = 12;
  let format = 1;
  let channels = 1;
  let sampleRate = 24_000;
  let bits = 16;
  let dataStart = -1;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      format = buffer.readUInt16LE(offset + 8);
      channels = buffer.readUInt16LE(offset + 10) || 1;
      sampleRate = buffer.readUInt32LE(offset + 12) || sampleRate;
      bits = buffer.readUInt16LE(offset + 22) || 16;
    } else if (id === "data") {
      dataStart = offset + 8;
      // Streamed WAVs report a placeholder size; trust the bytes we actually have.
      dataSize = Math.min(size, buffer.length - dataStart);
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0) throw new Error("WAV has no audio data");
  const bytes = bits / 8;
  const frames = Math.floor(dataSize / (bytes * channels));
  const samples = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let mix = 0;
    for (let c = 0; c < channels; c++) {
      const at = dataStart + (i * channels + c) * bytes;
      if (format === 3 && bits === 32) mix += buffer.readFloatLE(at);
      else if (bits === 16) mix += buffer.readInt16LE(at) / 32768;
      else if (bits === 32) mix += buffer.readInt32LE(at) / 2147483648;
      else mix += buffer[at] / 128 - 1;
    }
    samples[i] = Math.max(-32768, Math.min(32767, Math.round((mix / channels) * 32768)));
  }
  return { samples, sampleRate };
}

export function resample(audio: PcmAudio, targetRate = OUTPUT_RATE): PcmAudio {
  if (audio.sampleRate === targetRate || audio.samples.length === 0) {
    return { samples: audio.samples, sampleRate: audio.sampleRate };
  }
  const ratio = audio.sampleRate / targetRate;
  const length = Math.floor(audio.samples.length / ratio);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, audio.samples.length - 1);
    const t = pos - left;
    out[i] = Math.round(audio.samples[left] * (1 - t) + audio.samples[right] * t);
  }
  return { samples: out, sampleRate: targetRate };
}

export function encodeWav(audio: PcmAudio): Buffer {
  const dataBytes = audio.samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(audio.sampleRate, 24);
  buffer.writeUInt32LE(audio.sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < audio.samples.length; i++) buffer.writeInt16LE(audio.samples[i], 44 + i * 2);
  return buffer;
}

/** Join WAV clips into one 16 kHz mono file with a short pause between clips. */
export function joinWavClips(clips: Buffer[], pauseMs = 220): { wav: Buffer; durationSeconds: number } {
  const parts = clips.map((clip) => resample(decodeWav(clip)).samples);
  const pause = new Int16Array(Math.round((OUTPUT_RATE * pauseMs) / 1000));
  const total = parts.reduce((sum, p) => sum + p.length, 0) + pause.length * Math.max(0, parts.length - 1);
  const samples = new Int16Array(total);
  let at = 0;
  parts.forEach((part, i) => {
    samples.set(part, at);
    at += part.length;
    if (i < parts.length - 1) at += pause.length;
  });
  return {
    wav: encodeWav({ samples, sampleRate: OUTPUT_RATE }),
    durationSeconds: Math.round(total / OUTPUT_RATE),
  };
}

export function ttsConfig() {
  return {
    model: process.env.GROQ_TTS_MODEL ?? "canopylabs/orpheus-v1-english",
    voice: process.env.GROQ_TTS_VOICE ?? "hannah",
    enabled: Boolean(ENV.groqApiKey) && process.env.GROQ_TTS_ENABLED !== "false",
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function speakPiece(input: string, model: string, voice: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${ENV.groqBaseUrl}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input, response_format: "wav" }),
      signal: AbortSignal.timeout(ENV.groqTimeoutMs),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await wait(Math.min(8_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2_000 * (attempt + 1)));
      continue;
    }
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`Groq speech failed (${response.status}) ${detail}`.trim());
  }
  throw new Error("Groq speech is busy. Try again shortly.");
}

/** Synthesize long text by speaking it in Orpheus-sized pieces and joining the clips. */
export async function synthesizeSpeech(text: string): Promise<{ wav: Buffer; durationSeconds: number; voice: string }> {
  const { model, voice, enabled } = ttsConfig();
  if (!enabled) throw new Error("Server speech is not configured.");
  const pieces = splitForSpeech(text).slice(0, 40);
  if (!pieces.length) throw new Error("Nothing to read aloud.");
  const clips: Buffer[] = new Array(pieces.length);
  let next = 0;
  const worker = async () => {
    while (next < pieces.length) {
      const index = next++;
      clips[index] = await speakPiece(pieces[index], model, voice);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, pieces.length) }, worker));
  const { wav, durationSeconds } = joinWavClips(clips);
  return { wav, durationSeconds, voice };
}
