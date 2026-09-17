import type { User } from "../../drizzle/schema";
import type { RetrievedChunkHit } from "../rag/index";
import type { LearningIntent } from "./intents";

export type AgentRole = User["role"];

export type AgentChatMessage = { role: "user" | "assistant"; content: string };

export type RetrievedChunk = RetrievedChunkHit & {
  documentTitle?: string;
  courseId?: number | null;
};

export type AgentState = {
  requestId: string;
  userId: number;
  role: AgentRole;
  courseId?: number;
  materialId?: number;
  sessionId?: number;
  intent: LearningIntent;
  learningGoal?: string;
  messages: AgentChatMessage[];
  retrievedChunks: RetrievedChunk[];
  selectedTool?: string;
  toolResults: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }>;
  response?: string;
};

export type AgentRunInput = {
  user: User;
  message: string;
  documentId?: number;
  courseId?: number | null;
  documentTitle?: string | null;
  documentText?: string | null;
  history?: AgentChatMessage[];
};

export type AgentRunResult = {
  response: string;
  intent: LearningIntent;
  requestId: string;
  toolsUsed: string[];
};

export const INSUFFICIENT_COURSE_CONTEXT =
  "I couldn't find enough information in your course materials to answer that accurately. You can open a specific lecture document or ask for a general explanation that is not tied to your course files.";

export const MAX_TOOL_CALLS = 4;
