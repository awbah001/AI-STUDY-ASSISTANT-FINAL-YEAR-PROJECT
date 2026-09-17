export type ValidatedQuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type ValidatedFlashcard = {
  question: string;
  answer: string;
};

/** Drop malformed model quiz items. Does not invent missing facts. */
export function validateQuizQuestions(raw: unknown): ValidatedQuizQuestion[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown }).questions)
      ? (raw as { questions: unknown[] }).questions
      : [];
  const questions: ValidatedQuizQuestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const question = String((item as { question?: unknown }).question ?? "").trim();
    const options = Array.isArray((item as { options?: unknown }).options)
      ? (item as { options: unknown[] }).options.map((opt) => String(opt ?? "").trim()).filter(Boolean)
      : [];
    const correctAnswer = String((item as { correctAnswer?: unknown }).correctAnswer ?? "").trim();
    const explanation = String((item as { explanation?: unknown }).explanation ?? "").trim();
    if (question.length < 3 || options.length < 2 || !correctAnswer) continue;
    const uniqueOptions = [...new Set(options)].slice(0, 4);
    if (uniqueOptions.length < 2) continue;
    const matched =
      uniqueOptions.find((opt) => opt.toLowerCase() === correctAnswer.toLowerCase()) ?? null;
    if (!matched) continue;
    questions.push({
      question,
      options: uniqueOptions,
      correctAnswer: matched,
      explanation: explanation || "See the document for details.",
    });
  }
  return questions;
}

export function validateFlashcards(raw: unknown): ValidatedFlashcard[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { flashcards?: unknown }).flashcards)
      ? (raw as { flashcards: unknown[] }).flashcards
      : [];
  const cards: ValidatedFlashcard[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const question = String((item as { question?: unknown }).question ?? "").trim();
    const answer = String((item as { answer?: unknown }).answer ?? "").trim();
    if (question.length < 3 || answer.length < 1) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ question, answer });
  }
  return cards;
}
