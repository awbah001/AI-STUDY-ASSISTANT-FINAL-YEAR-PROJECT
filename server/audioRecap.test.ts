import { afterEach, describe, expect, it, vi } from "vitest";
import { recapLengthForDocument, splitRecapSpeech } from "../shared/audioRecap";
import { scriptFromSummary, writeRecapScript } from "./audioRecap";
import { invokeLLM } from "./_core/llm";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

const words = (count: number) =>
  Array.from({ length: count }, (_, i) => `concept${i}`).join(" ");
const response = (text: string) =>
  ({ choices: [{ message: { content: text } }] }) as Awaited<
    ReturnType<typeof invokeLLM>
  >;
afterEach(() => vi.resetAllMocks());

describe("document-length audio recaps", () => {
  it("targets six minutes for regular documents and extends longer documents up to twelve", () => {
    expect(recapLengthForDocument(words(2000))).toMatchObject({
      minutes: 6,
      minWords: 936,
    });
    expect(recapLengthForDocument(words(6000)).minutes).toBe(7);
    expect(recapLengthForDocument(words(15000)).minutes).toBe(10);
    expect(recapLengthForDocument(words(100000)).minutes).toBe(12);
  });

  it("keeps a longer script intact and includes passages from the end of the upload", async () => {
    const script = words(1500);
    vi.mocked(invokeLLM).mockResolvedValue(response(script));
    expect(
      await writeRecapScript(
        "Biology",
        "A summary",
        [],
        words(10000) + " FINAL_SECTION"
      )
    ).toBe(script);
    const request = vi.mocked(invokeLLM).mock.calls[0][0];
    expect(JSON.stringify(request.messages)).toContain("FINAL_SECTION");
    expect(request.max_tokens).toBeGreaterThan(1200);
  });

  it("rewrites an undersized draft instead of accepting a one-minute recap", async () => {
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(response(words(200)))
      .mockResolvedValueOnce(response(words(1000)));
    const script = await writeRecapScript(
      "Biology",
      "A summary",
      [],
      words(2000)
    );
    expect(script.split(/\s+/)).toHaveLength(1000);
    expect(invokeLLM).toHaveBeenCalledTimes(2);
  });

  it("falls back to source material when generation is unavailable without the old character cutoff", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("Unavailable"));
    const summary = words(1000) + ".";
    const script = await writeRecapScript("Biology", summary, [], words(2000));
    expect(script).toBe(scriptFromSummary("Biology", summary));
    expect(script).toContain("concept999.");
  });

  it("splits long device narration without losing its last paragraph or exceeding the device limit", () => {
    const text = Array.from(
      { length: 160 },
      (_, i) => `This is sentence ${i} about the material.`
    ).join(" ");
    const parts = splitRecapSpeech(text, 300);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every(part => part.length <= 300)).toBe(true);
    expect(parts.join(" ")).toBe(text);
    expect(splitRecapSpeech("")).toEqual([]);
  });
});
