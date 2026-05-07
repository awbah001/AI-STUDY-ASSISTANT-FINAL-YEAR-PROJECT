import { describe, it, expect, vi, beforeEach } from "vitest";
import * as llmUtils from "./llmUtils";

// Mock the invokeLLM function
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";

describe("LLM Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateDocumentSummary", () => {
    it("should generate a summary with key points", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "This is a test summary",
                keyPoints: ["Point 1", "Point 2", "Point 3"],
              }),
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await llmUtils.generateDocumentSummary(
        1,
        "Test document content",
        "Test Document"
      );

      expect(result).toEqual({
        summary: "This is a test summary",
        keyPoints: ["Point 1", "Point 2", "Point 3"],
      });

      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "system",
              content: expect.stringContaining("summarizer"),
            }),
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining("Test Document"),
            }),
          ]),
        })
      );
    });

    it("should throw error on invalid response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "invalid json",
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      await expect(
        llmUtils.generateDocumentSummary(1, "Test content", "Test Doc")
      ).rejects.toThrow();
    });
  });

  describe("generateFlashcards", () => {
    it("should generate flashcards with questions and answers", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                flashcards: [
                  { question: "Q1?", answer: "A1" },
                  { question: "Q2?", answer: "A2" },
                ],
              }),
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await llmUtils.generateFlashcards(
        1,
        "Test document",
        "Test Doc",
        2
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ question: "Q1?", answer: "A1" });
      expect(result[1]).toEqual({ question: "Q2?", answer: "A2" });
    });

    it("should generate default 10 flashcards when count not specified", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                flashcards: Array(10)
                  .fill(null)
                  .map((_, i) => ({
                    question: `Q${i}?`,
                    answer: `A${i}`,
                  })),
              }),
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await llmUtils.generateFlashcards(
        1,
        "Test document",
        "Test Doc"
      );

      expect(result).toHaveLength(10);
    });
  });

  describe("generateQuiz", () => {
    it("should generate quiz questions with options", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                questions: [
                  {
                    question: "What is 2+2?",
                    options: ["3", "4", "5", "6"],
                    correctAnswer: "4",
                    explanation: "2+2 equals 4",
                  },
                ],
              }),
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await llmUtils.generateQuiz(
        1,
        "Test document",
        "Test Doc",
        1
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        question: "What is 2+2?",
        options: ["3", "4", "5", "6"],
        correctAnswer: "4",
        explanation: "2+2 equals 4",
      });
    });

    it("should generate default 5 questions when count not specified", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                questions: Array(5)
                  .fill(null)
                  .map((_, i) => ({
                    question: `Q${i}?`,
                    options: ["A", "B", "C", "D"],
                    correctAnswer: "A",
                    explanation: "Explanation",
                  })),
              }),
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await llmUtils.generateQuiz(1, "Test document", "Test Doc");

      expect(result).toHaveLength(5);
    });
  });

  describe("generateDocumentAwareResponse", () => {
    it("should generate context-aware response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "This is a helpful response based on the document.",
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await llmUtils.generateDocumentAwareResponse(
        1,
        "What is the main topic?",
        "Document content about AI",
        "AI Guide",
        []
      );

      expect(result).toBe("This is a helpful response based on the document.");

      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "system",
              content: expect.stringContaining("learning assistant"),
            }),
          ]),
        })
      );
    });

    it("should include chat history in context", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Response with history context",
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const chatHistory = [
        { role: "user" as const, content: "Follow-up question" },
        { role: "assistant" as const, content: "Previous answer" },
        { role: "user" as const, content: "Previous question" },
      ];

      await llmUtils.generateDocumentAwareResponse(
        1,
        "Follow-up question",
        "Document content",
        "Test Doc",
        chatHistory
      );

      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: "Previous question",
            }),
            expect.objectContaining({
              role: "assistant",
              content: "Previous answer",
            }),
          ]),
        })
      );
    });
  });
});
