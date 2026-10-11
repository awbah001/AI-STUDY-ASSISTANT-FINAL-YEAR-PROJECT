import { describe, expect, it } from "vitest";
import {
  clampMarks,
  distribute,
  heuristicShortAnswerMark,
  normalizeShortAnswerItems,
  planExamMix,
  samplePassages,
  scoreTotals,
  shuffled,
} from "./examMarking";
import { decodeWav, encodeWav, joinWavClips, resample, splitForSpeech, TTS_MAX_CHARS } from "./tts";
import { defaultReviewTime, flashcardAnswer } from "./practice";
import { scriptFromSummary } from "./audioRecap";
import { formatCountdown, topicBreakdown } from "../shared/studentFeatures";

describe("mock exam marking helpers", () => {
  it("plans about a quarter short-answer questions", () => {
    expect(planExamMix(4)).toEqual({ mcq: 4, short: 0 });
    expect(planExamMix(5)).toEqual({ mcq: 4, short: 1 });
    expect(planExamMix(20)).toEqual({ mcq: 15, short: 5 });
  });

  it("distributes questions evenly across documents", () => {
    expect(distribute(10, 3)).toEqual([4, 3, 3]);
    expect(distribute(2, 4)).toEqual([1, 1, 0, 0]);
    expect(distribute(5, 0)).toEqual([]);
  });

  it("samples passages from across a long document", () => {
    const text = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(" ");
    const sample = samplePassages(text, 1000, 4);
    expect(sample).toContain("word0");
    expect(sample).toContain("word1999");
    expect(sample.length).toBeLessThan(1100);
  });

  it("parses short-answer items and skips multiple choice", () => {
    const items = normalizeShortAnswerItems({
      questions: [
        { type: "short", question: "Explain what photosynthesis produces.", modelAnswer: "Glucose and oxygen", keyPoints: ["glucose", "oxygen"] },
        { type: "mcq", question: "Which gas is released?", options: ["O2", "CO2"], correctAnswer: "O2" },
        { question: "Too short?", modelAnswer: "" },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].keyPoints).toEqual(["glucose", "oxygen"]);
  });

  it("clamps awarded marks to half-mark steps", () => {
    expect(clampMarks(2.3, 3)).toBe(2.5);
    expect(clampMarks(9, 3)).toBe(3);
    expect(clampMarks(-1, 3)).toBe(0);
    expect(clampMarks("nonsense", 3)).toBe(0);
  });

  it("marks short answers by key-point coverage when the AI is unavailable", () => {
    const keyPoints = ["Chlorophyll absorbs light energy", "Carbon dioxide and water form glucose"];
    expect(heuristicShortAnswerMark("", keyPoints, 3).marks).toBe(0);
    expect(heuristicShortAnswerMark("Chlorophyll absorbs light energy in leaves", keyPoints, 3).marks).toBe(1.5);
    const full = heuristicShortAnswerMark(
      "Chlorophyll absorbs light energy, then carbon dioxide and water are turned into glucose",
      keyPoints,
      3
    );
    expect(full.marks).toBe(3);
  });

  it("totals marks and percent", () => {
    expect(
      scoreTotals([
        { type: "mcq", marks: 1, awardedMarks: 1 },
        { type: "mcq", marks: 1, awardedMarks: 0 },
        { type: "short", marks: 3, awardedMarks: 1.5 },
      ])
    ).toEqual({ totalMarks: 5, earnedMarks: 2.5, scorePercent: 50 });
  });

  it("shuffles without losing items", () => {
    const out = shuffled([1, 2, 3, 4], () => 0);
    expect([...out].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("speech helpers", () => {
  it("splits long text into pieces under the Groq limit", () => {
    const text = "This is a sentence about cells. ".repeat(30) + "A".repeat(500);
    const pieces = splitForSpeech(text);
    expect(pieces.length).toBeGreaterThan(3);
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(TTS_MAX_CHARS);
  });

  it("drops markdown symbols", () => {
    expect(splitForSpeech("**Bold** and `code`")).toEqual(["Bold and code"]);
  });

  it("round-trips 16-bit WAV audio", () => {
    const samples = Int16Array.from([0, 1000, -1000, 32767, -32767]);
    const decoded = decodeWav(encodeWav({ samples, sampleRate: 16000 }));
    expect(decoded.sampleRate).toBe(16000);
    expect(Array.from(decoded.samples)).toEqual(Array.from(samples));
  });

  it("decodes streamed WAVs with a placeholder data size", () => {
    const wav = encodeWav({ samples: Int16Array.from([5, 6, 7]), sampleRate: 24000 });
    wav.writeUInt32LE(0xffffffff, 40);
    expect(decodeWav(wav).samples.length).toBe(3);
  });

  it("resamples and joins clips with pauses", () => {
    const second = new Int16Array(24000).fill(100);
    expect(resample({ samples: second, sampleRate: 24000 }).samples.length).toBe(16000);
    const clip = encodeWav({ samples: second, sampleRate: 24000 });
    const joined = joinWavClips([clip, clip], 500);
    expect(joined.durationSeconds).toBe(3);
    expect(decodeWav(joined.wav).samples.length).toBe(16000 * 2 + 8000);
  });

  it("rejects files that are not WAV", () => {
    expect(() => decodeWav(Buffer.from("not audio at all"))).toThrow();
  });
});

describe("practice and recap helpers", () => {
  it("builds flashcard answers with key points and explanations", () => {
    const answer = flashcardAnswer({
      documentId: 1,
      question: "What is osmosis?",
      correctAnswer: "Movement of water across a membrane",
      keyPoints: ["water", "semi-permeable membrane"],
      explanation: "From low to high solute concentration.",
    });
    expect(answer).toContain("Key points: water; semi-permeable membrane");
    expect(answer).toContain("From low to high");
  });

  it("schedules review for the next evening and at least six hours away", () => {
    const morning = new Date(2026, 0, 5, 9, 0).getTime();
    const review = new Date(defaultReviewTime(morning));
    expect(review.getDate()).toBe(6);
    expect(review.getHours()).toBe(18);
    const lateNight = new Date(2026, 0, 5, 23, 30).getTime();
    expect(defaultReviewTime(lateNight) - lateNight).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
  });

  it("writes a plain spoken script from a markdown summary", () => {
    const script = scriptFromSummary("Cells", "## Overview\n- **Cells** are the unit of life.", ["Cells divide"]);
    expect(script).toBe("Here is your recap of Cells. Overview Cells are the unit of life. To remember: Cells divide.");
  });

  it("formats countdowns and topic breakdowns", () => {
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
    expect(
      topicBreakdown([
        { topic: "Cells", marks: 2, awardedMarks: 2 },
        { topic: "Genetics", marks: 3, awardedMarks: 0 },
        { documentTitle: "Week 1", marks: 1, awardedMarks: null },
      ]).map((t) => [t.topic, t.percent])
    ).toEqual([
      ["Genetics", 0],
      ["Week 1", 0],
      ["Cells", 100],
    ]);
  });
});
