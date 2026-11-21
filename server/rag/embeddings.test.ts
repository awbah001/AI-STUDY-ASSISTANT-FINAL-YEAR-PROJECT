import { describe, it, expect, vi } from "vitest";
const { pipeline, encode } = vi.hoisted(() => ({
  pipeline: vi.fn(),
  encode: vi.fn(),
}));
vi.mock("@xenova/transformers", () => ({ pipeline }));
describe("embedding initialization and cache keys", () => {
  it("shares model initialization and does not collide on long common prefixes", async () => {
    vi.resetModules();
    encode.mockImplementation(async (text: string) => ({
      data: Float32Array.from([text.endsWith("A") ? 1 : 2, 0]),
    }));
    pipeline.mockImplementation(async () => encode);
    const { embedText } = await import("./embeddings");
    const prefix = "same introduction ".repeat(30);
    const [a, b] = await Promise.all([
      embedText(prefix + "A"),
      embedText(prefix + "B"),
    ]);
    expect(pipeline).toHaveBeenCalledTimes(1);
    expect(a).not.toEqual(b);
    await embedText(prefix + "A");
    expect(encode).toHaveBeenCalledTimes(2);
  });
});
