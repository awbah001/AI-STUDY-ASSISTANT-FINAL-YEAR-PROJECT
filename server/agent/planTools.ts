import { requestedCount, type LearningIntent } from "./intents";
import type { AgentRunInput } from "./types";
import { MAX_TOOL_CALLS } from "./types";

/**
 * Legacy deterministic planner — retained for tests and as documentation of
 * previous tool routing. The live path uses Groq tool-calling instead.
 */
export function planTools(
  intent: LearningIntent,
  input: AgentRunInput,
  courseId?: number
): Array<{ name: string; args: unknown }> {
  const documentId = input.documentId && input.documentId > 0 ? input.documentId : undefined;
  const countQuiz = requestedCount(input.message, 5, 3, 20);
  const countCards = requestedCount(input.message, 10, 3, 30);

  switch (intent) {
    case "quiz":
      return documentId ? [{ name: "generateQuizDraft", args: { documentId, count: countQuiz } }] : [];
    case "flashcards":
      return documentId ? [{ name: "generateFlashcards", args: { documentId, count: countCards } }] : [];
    case "summary":
      return documentId ? [{ name: "generateSummary", args: { documentId } }] : [];
    case "assignment":
      return [{ name: "getAssignmentContext", args: { courseId } }];
    case "progress":
      return [
        { name: "getLearningProgress", args: { documentId } },
        { name: "createStudyPlan", args: { courseId } },
      ];
    case "study_session":
      return [
        courseId
          ? { name: "searchCourseMaterial", args: { courseId, query: input.message } }
          : documentId
            ? { name: "getMaterialContext", args: { documentId, query: input.message } }
            : { name: "getLearningProgress", args: {} },
        { name: "createStudyPlan", args: { courseId } },
        ...(documentId
          ? [{ name: "recordStudyActivity", args: { documentId, activityType: "chat" as const } }]
          : []),
      ];
    case "calendar":
      return [
        { name: "getLearningProgress", args: { documentId } },
        { name: "createStudyPlan", args: { courseId } },
        { name: "listCalendarEvents", args: {} },
      ];
    case "qa":
      if (courseId && !documentId) {
        return [{ name: "searchCourseMaterial", args: { courseId, query: input.message } }];
      }
      if (documentId) {
        return [{ name: "getMaterialContext", args: { documentId, query: input.message } }];
      }
      return [];
    default:
      if (documentId) {
        return [{ name: "getMaterialContext", args: { documentId, query: input.message } }];
      }
      return [];
  }
}

export { MAX_TOOL_CALLS };
