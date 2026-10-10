import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@xenova/transformers", () => ({ pipeline: vi.fn() }));
vi.mock("./_core/env", () => ({
  ENV: {
    groqApiKey: "test-key",
    groqBaseUrl: "https://groq.test/v1",
    groqSttModel: "whisper-large-v3-turbo",
    groqTimeoutMs: 5000,
  },
}));

import { transcribeStudentAudio } from "./voice";

const m4aBase64 = Buffer.alloc(512, 7).toString("base64");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transcribeStudentAudio", () => {
  it("sends compressed recordings to Groq with a matching file extension", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: " What is photosynthesis? " }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcribeStudentAudio(m4aBase64, "audio/m4a")).resolves.toBe("What is photosynthesis?");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://groq.test/v1/audio/transcriptions");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect((form.get("file") as File).name).toBe("speech.m4a");
  });

  it("explains the failure when Groq cannot transcribe a non-WAV recording", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(transcribeStudentAudio(m4aBase64, "audio/m4a")).rejects.toThrow(/convert speech to text/i);
  });

  it("reports silence instead of returning punctuation-only text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: " ." }), { status: 200 }))
    );

    await expect(transcribeStudentAudio(m4aBase64, "audio/m4a")).rejects.toThrow(/no speech detected/i);
  });

  it("rejects recordings that are too short", async () => {
    await expect(transcribeStudentAudio(Buffer.alloc(10).toString("base64"))).rejects.toThrow(/too short/i);
  });
});
