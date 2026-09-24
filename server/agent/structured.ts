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

function optionText(opt: unknown): string {
  if (opt == null) return "";
  if (typeof opt === "string" || typeof opt === "number") return String(opt).trim();
  if (typeof opt !== "object") return "";
  const rec = opt as Record<string, unknown>;
  const nested = rec.text ?? rec.option ?? rec.value ?? rec.answer ?? rec.content ?? rec.label;
  if (nested != null && nested !== opt) return optionText(nested);
  return "";
}

function stripChoiceLabel(text: string): string {
  return text.replace(/^\s*(?:[A-Da-d]|[1-4])[.)]\s+/, "").trim();
}

function isPlaceholderOption(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^[A-Da-d]$/.test(t)) return true;
  if (/^option\s*[A-Da-d]$/i.test(t)) return true;
  return false;
}

function splitLabeledChoices(text: string): string[] {
  if (!text.trim()) return [];
  const labeled = text
    .split(/(?:\n|(?<=\s))(?=(?:[A-Da-d]|[1-4])[.)]\s+)/)
    .map((part) => stripChoiceLabel(part))
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 1 && !isPlaceholderOption(part));
  if (labeled.length >= 2) return labeled;
  const lines = text
    .split(/\n+/)
    .map((line) => stripChoiceLabel(line))
    .filter((line) => line.length > 1);
  return lines.length >= 2 ? lines : [];
}

function collectQuizLikeItems(raw: unknown, acc: unknown[]): void {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    for (const item of raw) collectQuizLikeItems(item, acc);
    return;
  }
  if (typeof raw !== "object") return;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.question === "string") acc.push(obj);
  if ("questions" in obj) collectQuizLikeItems(obj.questions, acc);
  if ("quiz" in obj) collectQuizLikeItems(obj.quiz, acc);
}

/** Turn messy LLM option shapes into four readable choice strings. */
export function coerceQuizOptions(item: unknown): string[] {
  if (!item || typeof item !== "object") return [];
  const rec = item as Record<string, unknown>;
  const raw = rec.options ?? rec.choices ?? rec.answers ?? rec.alternatives ?? rec.answerChoices;

  let opts: string[] = [];
  if (Array.isArray(raw)) {
    opts = raw.map(optionText).map(stripChoiceLabel).filter(Boolean);
  } else if (typeof raw === "string") {
    opts = splitLabeledChoices(raw);
  } else if (raw && typeof raw === "object") {
    opts = Object.keys(raw as object)
      .sort()
      .map((key) => optionText((raw as Record<string, unknown>)[key]))
      .map(stripChoiceLabel)
      .filter(Boolean);
  }

  if (opts.length < 2) {
    const fromLetters = ["A", "B", "C", "D"]
      .map((letter) => optionText(rec[letter] ?? rec[letter.toLowerCase()]))
      .map(stripChoiceLabel)
      .filter(Boolean);
    if (fromLetters.length >= 2) opts = fromLetters;
  }

  if (opts.length < 2 && typeof rec.question === "string") {
    const fromQuestion = splitLabeledChoices(rec.question);
    if (fromQuestion.length >= 2) opts = fromQuestion.slice(-4);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const opt of opts) {
    if (isPlaceholderOption(opt)) continue;
    const key = opt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(opt);
    if (unique.length >= 4) break;
  }
  return unique;
}

export function resolveCorrectAnswer(correct: string, options: string[]): string | null {
  const answer = correct.trim();
  if (!answer || options.length === 0) return null;
  const exact = options.find((opt) => opt.toLowerCase() === answer.toLowerCase());
  if (exact) return exact;

  const letter = answer.match(/^([A-Da-d])(?:[.)].*)?$/);
  if (letter) {
    const idx = letter[1].toUpperCase().charCodeAt(0) - 65;
    if (options[idx]) return options[idx];
  }
  const numbered = answer.match(/^([1-4])(?:[.)].*)?$/);
  if (numbered) {
    const idx = Number(numbered[1]) - 1;
    if (options[idx]) return options[idx];
  }

  const contained = options.find(
    (opt) =>
      opt.toLowerCase().includes(answer.toLowerCase()) || answer.toLowerCase().includes(opt.toLowerCase())
  );
  return contained ?? null;
}

function stemQuestion(question: string, options: string[]): string {
  const cut = question.search(/\n\s*[A-Da-d][.)]\s/);
  if (cut > 8 && options.length >= 2) return question.slice(0, cut).trim();
  return question.trim();
}

/**
 * Drop malformed model quiz items. Does not invent missing facts.
 * `minOptions` is 4 for generation so incomplete choice lists are retried.
 */
export function validateQuizQuestions(raw: unknown, minOptions = 2): ValidatedQuizQuestion[] {
  const collected: unknown[] = [];
  collectQuizLikeItems(raw, collected);
  const list = collected.length ? collected : Array.isArray(raw) ? raw : [];
  const questions: ValidatedQuizQuestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const options = coerceQuizOptions(rec);
    if (options.length < minOptions) continue;
    const question = stemQuestion(String(rec.question ?? "").trim(), options);
    const correctRaw = String(rec.correctAnswer ?? rec.answer ?? rec.correct ?? "").trim();
    const explanation = String(rec.explanation ?? "").trim();
    if (question.length < 3 || !correctRaw) continue;
    const matched = resolveCorrectAnswer(correctRaw, options);
    if (!matched) continue;
    questions.push({
      question,
      options,
      correctAnswer: matched,
      explanation: explanation || "See the document for details.",
    });
  }
  return questions;
}

export function sanitizeStoredQuizQuestion<T extends { question: string; options: unknown; correctAnswer: string }>(
  question: T
): T & { options: string[] } {
  let options = coerceQuizOptions({
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
  });
  if (options.length < 2 && Array.isArray(question.options)) {
    options = question.options.map((opt) => String(opt ?? "").trim()).filter(Boolean).slice(0, 4);
  }
  const correctAnswer =
    resolveCorrectAnswer(question.correctAnswer, options) ?? question.correctAnswer;
  return { ...question, options, correctAnswer };
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
    const rec = item as Record<string, unknown>;
    const question = String(rec.question ?? rec.front ?? rec.term ?? "").trim();
    const answer = String(rec.answer ?? rec.back ?? rec.definition ?? "").trim();
    if (question.length < 3 || answer.length < 1) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ question, answer });
  }
  return cards;
}
