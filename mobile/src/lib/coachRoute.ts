import type { Href } from "expo-router";

const TAB_ROUTES: Record<string, string> = {
  dashboard: "/(tabs)/dashboard",
  courses: "/(tabs)/courses",
  flashcards: "/(tabs)/flashcards",
  quizzes: "/(tabs)/quizzes",
  planner: "/(tabs)/planner",
  progress: "/(tabs)/progress",
};

/** Screen to open for an AI study coach notification, or null if it is not one. */
export function coachRoute(data: Record<string, unknown> | null | undefined): Href | null {
  if (data?.type !== "ai_coach") return null;
  const documentId = Number(data.documentId);
  if (data.target === "document" && Number.isFinite(documentId) && documentId > 0) {
    return { pathname: "/document/[id]", params: { id: String(documentId) } } as Href;
  }
  return (TAB_ROUTES[String(data.target)] ?? "/(tabs)/dashboard") as Href;
}
