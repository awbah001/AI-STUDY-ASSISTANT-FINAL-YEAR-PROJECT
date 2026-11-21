import { afterEach, expect, it, vi } from "vitest";
import { decodeWav, encodeWav, splitForSpeech, synthesizeSpeech } from "./tts";

vi.mock("./_core/env", () => ({
  ENV: {
    groqApiKey: "test-only",
    groqBaseUrl: "https://speech.invalid",
    groqTimeoutMs: 1000,
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("records every chunk of a long recap, including chunks beyond the previous forty-piece limit", async () => {
  vi.stubEnv("GROQ_TTS_ENABLED", "true");
  const text = Array.from(
    { length: 200 },
    (_, i) =>
      `Sentence ${i} explains an important concept from the uploaded document.`
  ).join(" ");
  const parts = splitForSpeech(text);
  expect(parts.length).toBeGreaterThan(40);
  const clip = encodeWav({ samples: new Int16Array(1600), sampleRate: 16000 });
  const fetchMock = vi.fn(
    async () => new Response(new Uint8Array(clip), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  const speech = await synthesizeSpeech(text);
  expect(fetchMock).toHaveBeenCalledTimes(parts.length);
  expect(
    fetchMock.mock.calls
      .map(
        call =>
          JSON.parse(
            (call as unknown as [string, RequestInit])[1].body as string
          ).input
      )
      .join(" ")
  ).toBe(text);
  expect(decodeWav(speech.wav).samples.length).toBeGreaterThan(
    parts.length * 1600
  );
});
