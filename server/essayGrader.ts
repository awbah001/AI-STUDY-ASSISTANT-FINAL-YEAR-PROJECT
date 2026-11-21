import { invokeLLM } from "./_core/llm";
import { llmMessageText, parseJsonFromLlmContent } from "./llmUtils";

export type EssayGradeResult = {
  /** 0–100 */
  score: number;
  feedback: string;
};

/**
 * Grade a student's essay answer using the LLM.
 * Returns a score (0-100) and brief constructive feedback.
 * Falls back gracefully on any failure so the quiz still submits.
 */
export async function gradeEssayAnswer(
  question: string,
  modelAnswer: string,
  keyPoints: string,
  studentAnswer: string
): Promise<EssayGradeResult> {
  if (!studentAnswer.trim()) {
    return { score: 0, feedback: "No answer provided." };
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an impartial exam marker. Output ONLY a JSON object. No markdown, no extra text. Start with { and end with }.",
        },
        {
          role: "user",
          content: `Grade this student's answer to an exam question.

Question: ${question}

Model answer: ${modelAnswer}

Marking criteria:
${keyPoints || modelAnswer}

Student's answer: ${studentAnswer}

Respond with ONLY this JSON:
{"score":75,"feedback":"The answer covers X well but misses Y. Consider including Z."}

Rules:
- "score": integer 0-100 (100 = perfectly complete, 0 = completely wrong/blank)
- "feedback": 1-3 sentences of constructive, specific feedback
- Be fair but accurate — partial credit for partial answers`,
        },
      ],
      max_tokens: 220,
      temperature: 0.3,
      taskType: "general",
    });

    const raw = llmMessageText(response.choices[0]?.message?.content).trim();
    const parsed = parseJsonFromLlmContent(raw) as { score?: unknown; feedback?: unknown };
    const score = typeof parsed.score === "number"
      ? Math.max(0, Math.min(100, Math.round(parsed.score)))
      : 50;
    const feedback = typeof parsed.feedback === "string" && parsed.feedback.trim()
      ? parsed.feedback.trim()
      : "Answer received.";
    return { score, feedback };
  } catch (err) {
    console.warn("[essay-grader] Grading failed, using fallback:", err);
    // Fallback: keyword matching heuristic
    const modelWords = new Set(
      modelAnswer.toLowerCase().split(/\W+/).filter(w => w.length > 4)
    );
    const studentWords = studentAnswer.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    const matches = studentWords.filter(w => modelWords.has(w)).length;
    const score = modelWords.size > 0
      ? Math.min(100, Math.round((matches / modelWords.size) * 100))
      : 50;
    return {
      score,
      feedback: "Your answer has been recorded. Detailed AI feedback is temporarily unavailable.",
    };
  }
}
