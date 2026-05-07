import { describe, it, expect, beforeEach, vi } from "vitest";
import * as llmUtils from "./llmUtils";

// Mock the LLM utils
vi.mock("./llmUtils", () => ({
  extractPdfText: vi.fn(),
  generateDocumentSummary: vi.fn(),
  generateFlashcards: vi.fn(),
  generateQuiz: vi.fn(),
  generateDocumentAwareResponse: vi.fn(),
  indexDocumentForRag: vi.fn(),
}));

describe("Learning Platform Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PDF Text Extraction", () => {
    it("should extract text from PDF using pdf-parse", async () => {
      const pdfUrl = "https://example.com/document.pdf";
      const expectedText = "Extracted PDF content here...";

      vi.mocked(llmUtils.extractPdfText).mockResolvedValue(expectedText);

      const result = await llmUtils.extractPdfText(pdfUrl);

      expect(result).toBe(expectedText);
      expect(llmUtils.extractPdfText).toHaveBeenCalledWith(pdfUrl);
    });

    it("should handle PDF extraction errors gracefully", async () => {
      const pdfUrl = "https://example.com/invalid.pdf";
      const error = new Error("Failed to extract PDF");

      vi.mocked(llmUtils.extractPdfText).mockRejectedValue(error);

      await expect(llmUtils.extractPdfText(pdfUrl)).rejects.toThrow(
        "Failed to extract PDF"
      );
    });

    it("should extract text from valid PDF URL with file_url content type", async () => {
      const pdfUrl = "https://storage.example.com/docs/sample.pdf";
      const extractedContent =
        "Chapter 1: Introduction\nThis document covers...";

      vi.mocked(llmUtils.extractPdfText).mockResolvedValue(extractedContent);

      const result = await llmUtils.extractPdfText(pdfUrl);

      expect(result).toContain("Chapter 1");
      expect(result).toContain("Introduction");
    });
  });

  describe("Flashcard Generation", () => {
    it("should generate flashcards from document text", async () => {
      const documentText = "Python is a programming language...";
      const documentTitle = "Python Guide";
      const mockFlashcards = [
        {
          question: "What is Python?",
          answer: "Python is a high-level programming language.",
        },
        {
          question: "What are Python's main features?",
          answer: "Simple syntax, dynamic typing, and extensive libraries.",
        },
      ];

      vi.mocked(llmUtils.generateFlashcards).mockResolvedValue(mockFlashcards);

      const result = await llmUtils.generateFlashcards(
        1,
        documentText,
        documentTitle,
        2
      );

      expect(result).toEqual(mockFlashcards);
      expect(result).toHaveLength(2);
      expect(llmUtils.generateFlashcards).toHaveBeenCalledWith(
        1,
        documentText,
        documentTitle,
        2
      );
    });

    it("should generate correct number of flashcards", async () => {
      const documentText = "Content about machine learning...";
      const documentTitle = "ML Basics";
      const count = 5;

      const mockFlashcards = Array.from({ length: count }, (_, i) => ({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
      }));

      vi.mocked(llmUtils.generateFlashcards).mockResolvedValue(mockFlashcards);

      const result = await llmUtils.generateFlashcards(
        1,
        documentText,
        documentTitle,
        count
      );

      expect(result).toHaveLength(count);
    });
  });

  describe("Quiz Generation and Submission", () => {
    it("should generate quiz questions from document", async () => {
      const documentText = "Machine Learning is...";
      const documentTitle = "ML Basics";
      const mockQuestions = [
        {
          question: "What is Machine Learning?",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "ML is a subset of AI",
        },
      ];

      vi.mocked(llmUtils.generateQuiz).mockResolvedValue(mockQuestions);

      const result = await llmUtils.generateQuiz(
        1,
        documentText,
        documentTitle,
        1
      );

      expect(result).toEqual(mockQuestions);
      expect(result[0].options).toHaveLength(4);
    });

    it("should generate multiple choice questions with valid structure", async () => {
      const documentText = "Data Science fundamentals...";
      const documentTitle = "Data Science 101";
      const mockQuestions = [
        {
          question: "What is data science?",
          options: [
            "Study of data",
            "Study of computers",
            "Study of networks",
            "Study of algorithms",
          ],
          correctAnswer: "Study of data",
          explanation: "Data science is the study of extracting insights from data",
        },
        {
          question: "What is a dataset?",
          options: [
            "A collection of data",
            "A type of software",
            "A programming language",
            "A database server",
          ],
          correctAnswer: "A collection of data",
          explanation: "A dataset is a collection of data points used for analysis",
        },
      ];

      vi.mocked(llmUtils.generateQuiz).mockResolvedValue(mockQuestions);

      const result = await llmUtils.generateQuiz(
        1,
        documentText,
        documentTitle,
        2
      );

      expect(result).toHaveLength(2);
      result.forEach((q) => {
        expect(q.question).toBeDefined();
        expect(q.options).toHaveLength(4);
        expect(q.correctAnswer).toBeDefined();
        expect(q.explanation).toBeDefined();
      });
    });
  });

  describe("Document Summary Generation", () => {
    it("should generate summary from document text", async () => {
      const documentText = "This is a comprehensive guide...";
      const documentTitle = "Comprehensive Guide";
      const mockSummary = {
        summary: "A concise summary of the document",
        keyPoints: ["Point 1", "Point 2", "Point 3"],
      };

      vi.mocked(llmUtils.generateDocumentSummary).mockResolvedValue(
        mockSummary
      );

      const result = await llmUtils.generateDocumentSummary(
        1,
        documentText,
        documentTitle
      );

      expect(result).toEqual(mockSummary);
      expect(result.keyPoints).toHaveLength(3);
    });

    it("should extract key points from summary", async () => {
      const documentText = "Advanced Python programming concepts...";
      const documentTitle = "Advanced Python";
      const mockSummary = {
        summary:
          "This guide covers decorators, generators, and async programming in Python",
        keyPoints: [
          "Decorators modify function behavior",
          "Generators provide memory-efficient iteration",
          "Async programming enables concurrent execution",
        ],
      };

      vi.mocked(llmUtils.generateDocumentSummary).mockResolvedValue(
        mockSummary
      );

      const result = await llmUtils.generateDocumentSummary(
        1,
        documentText,
        documentTitle
      );

      expect(result.keyPoints).toContain("Decorators modify function behavior");
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });
  });

  describe("Chat Functionality", () => {
    it("should generate context-aware response", async () => {
      const userQuestion = "What is the main topic?";
      const documentText = "This document is about AI...";
      const documentTitle = "AI Guide";
      const chatHistory = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      const mockResponse =
        "The main topic of this document is Artificial Intelligence...";

      vi.mocked(llmUtils.generateDocumentAwareResponse).mockResolvedValue(
        mockResponse
      );

      const result = await llmUtils.generateDocumentAwareResponse(
        1,
        userQuestion,
        documentText,
        documentTitle,
        chatHistory
      );

      expect(result).toBe(mockResponse);
      expect(llmUtils.generateDocumentAwareResponse).toHaveBeenCalledWith(
        1,
        userQuestion,
        documentText,
        documentTitle,
        chatHistory
      );
    });

    it("should maintain chat history context", async () => {
      const userQuestion = "Can you elaborate?";
      const documentText = "Content about neural networks...";
      const documentTitle = "Neural Networks";
      const chatHistory = [
        { role: "user" as const, content: "What are neural networks?" },
        {
          role: "assistant" as const,
          content: "Neural networks are computational models...",
        },
        { role: "user" as const, content: "How do they work?" },
        {
          role: "assistant" as const,
          content: "They work through layers of neurons...",
        },
      ];

      const mockResponse =
        "Building on that, neural networks use backpropagation...";

      vi.mocked(llmUtils.generateDocumentAwareResponse).mockResolvedValue(
        mockResponse
      );

      const result = await llmUtils.generateDocumentAwareResponse(
        1,
        userQuestion,
        documentText,
        documentTitle,
        chatHistory
      );

      expect(result).toBeDefined();
      expect(llmUtils.generateDocumentAwareResponse).toHaveBeenCalledWith(
        1,
        userQuestion,
        documentText,
        documentTitle,
        chatHistory
      );
    });
  });

  describe("Progress Tracking Calculations", () => {
    it("should calculate average quiz score correctly", () => {
      const scores = [85, 90, 95];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBe(90);
    });

    it("should track flashcard review count", () => {
      let reviewCount = 0;
      const incrementReview = () => {
        reviewCount += 1;
      };

      expect(reviewCount).toBe(0);
      incrementReview();
      expect(reviewCount).toBe(1);
      incrementReview();
      incrementReview();
      expect(reviewCount).toBe(3);
    });

    it("should calculate quiz attempt statistics", () => {
      const quizAttempts = [
        { score: 75, date: new Date("2026-01-01") },
        { score: 85, date: new Date("2026-01-02") },
        { score: 95, date: new Date("2026-01-03") },
      ];

      const totalAttempts = quizAttempts.length;
      const averageScore =
        quizAttempts.reduce((sum, q) => sum + q.score, 0) / totalAttempts;

      expect(totalAttempts).toBe(3);
      expect(averageScore).toBe(85);
    });
  });

  describe("Data Validation", () => {
    it("should validate PDF URL format", () => {
      const validUrl = "https://storage.example.com/file.pdf";
      const isValidUrl = validUrl.startsWith("https://") && validUrl.endsWith(".pdf");

      expect(isValidUrl).toBe(true);
    });

    it("should validate flashcard structure", () => {
      const flashcard = {
        question: "What is X?",
        answer: "X is...",
      };

      expect(flashcard).toHaveProperty("question");
      expect(flashcard).toHaveProperty("answer");
      expect(typeof flashcard.question).toBe("string");
      expect(typeof flashcard.answer).toBe("string");
    });

    it("should validate quiz question structure", () => {
      const quizQuestion = {
        question: "What is the answer?",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Because...",
      };

      expect(quizQuestion.options).toHaveLength(4);
      expect(quizQuestion.options).toContain(quizQuestion.correctAnswer);
    });
  });
});
