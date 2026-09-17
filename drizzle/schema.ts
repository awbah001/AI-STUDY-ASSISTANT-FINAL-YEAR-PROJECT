import { int, sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = sqliteTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email").unique(),
  loginMethod: text("loginMethod"),
  /**
   * For local (email/password) auth only.
   * Stored as `base64(salt):base64(hash)` produced by scrypt.
   */
  passwordHash: text("passwordHash"),
  /** Public URL for profile image (e.g. /uploads/avatars/...). */
  avatarUrl: text("avatarUrl"),
  role: text("role", { enum: ["user", "admin", "lecturer"] }).default("user").notNull(),
  isBanned: integer("isBanned", { mode: "boolean" }).default(false).notNull(),
  /** Expo push token — saved when student registers their device */
  expoPushToken: text("expoPushToken"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" }).notNull().default(new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Documents table
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject"), // New field for subject categorization
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  fileName: text("fileName").notNull(),
  fileSize: integer("fileSize").notNull(),
  mimeType: text("mimeType").default("application/pdf").notNull(),
  extractedText: text("extractedText"),
  isFavorite: integer("isFavorite", { mode: "boolean" }).default(false).notNull(),
  isPublic: integer("isPublic", { mode: "boolean" }).default(false).notNull(),
  /** When set, document belongs to a lecturer course; enrolled students may access. */
  courseId: integer("courseId"),
  materialType: text("materialType", {
    enum: ["pdf", "docx", "pptx", "notes", "slides", "assignment", "other"],
  }).default("pdf"),
  /** Lifecycle of text extraction and vector indexing, visible to admins. */
  processingStatus: text("processingStatus", { enum: ["pending", "processing", "ready", "failed"] }).default("pending").notNull(),
  processingError: text("processingError"),
  reportCount: integer("reportCount").default(0).notNull(),
  moderationNote: text("moderationNote"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  userIdIdx: index("userIdIdx").on(table.userId),
  courseIdIdx: index("documents_courseId_idx").on(table.courseId),
}));

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Chat messages table
export const chatMessages = sqliteTable("chatMessages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("documentId").notNull(),
  userId: integer("userId").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  documentIdIdx: index("documentIdIdx").on(table.documentId),
  userIdIdx: index("userIdIdx").on(table.userId),
}));

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Document summaries table
export const documentSummaries = sqliteTable("documentSummaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("documentId").notNull(),
  summary: text("summary").notNull(),
  keyPoints: text("keyPoints", { mode: "json" }).$type<string[]>(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  documentIdIdx: index("documentIdIdx").on(table.documentId),
}));

export type DocumentSummary = typeof documentSummaries.$inferSelect;
export type InsertDocumentSummary = typeof documentSummaries.$inferInsert;

// Flashcards table
export const flashcards = sqliteTable("flashcards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("documentId").notNull(),
  userId: integer("userId").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  isFavorite: integer("isFavorite", { mode: "boolean" }).default(false).notNull(),
  reviewCount: integer("reviewCount").default(0).notNull(),
  lastReviewedAt: integer("lastReviewedAt", { mode: "timestamp_ms" }),

  // ── SM-2 spaced-repetition fields ─────────────────────────────────────────
  /** How easy the card is: starts at 2.5, min 1.3. Adjusted after each rating. */
  easeFactor: real("easeFactor").default(2.5).notNull(),
  /** Current review interval in days (0 = new, 1 = tomorrow, etc.) */
  srInterval: integer("srInterval").default(0).notNull(),
  /** Number of consecutive successful repetitions */
  repetitions: integer("repetitions").default(0).notNull(),
  /** Absolute timestamp when the card is next due (ms since epoch). NULL = due now. */
  dueDate: integer("dueDate", { mode: "timestamp_ms" }),

  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  flashcardDocumentIdIdx: index("flashcard_documentId_idx").on(table.documentId),
  flashcardUserIdIdx: index("flashcard_userId_idx").on(table.userId),
  flashcardDueDateIdx: index("flashcard_dueDate_idx").on(table.dueDate),
}));

export type Flashcard = typeof flashcards.$inferSelect;
export type InsertFlashcard = typeof flashcards.$inferInsert;

// Quizzes table
export const quizzes = sqliteTable("quizzes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("documentId").notNull(),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  totalQuestions: integer("totalQuestions").notNull(),
  score: text("score"),
  completedAt: integer("completedAt", { mode: "timestamp_ms" }),
  /** Optional lecturer-set deadline for course quizzes. */
  dueDate: integer("dueDate", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  documentIdIdx: index("documentIdIdx").on(table.documentId),
  userIdIdx: index("userIdIdx").on(table.userId),
}));

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

// Quiz questions table
export const quizQuestions = sqliteTable("quizQuestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quizId: integer("quizId").notNull(),
  question: text("question").notNull(),
  options: text("options", { mode: "json" }).$type<string[]>().notNull(),
  correctAnswer: text("correctAnswer").notNull(),
  explanation: text("explanation"),
  userAnswer: text("userAnswer"),
  isCorrect: integer("isCorrect", { mode: "boolean" }),
}, (table) => ({
  quizIdIdx: index("quizIdIdx").on(table.quizId),
}));

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

// Study sessions table - tracks time spent studying
export const studySessions = sqliteTable("studySessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  documentId: integer("documentId"),
  startTime: integer("startTime", { mode: "timestamp_ms" }).notNull(),
  endTime: integer("endTime", { mode: "timestamp_ms" }),
  durationMinutes: integer("durationMinutes"), // Calculated duration in minutes
  activityType: text("activityType", { enum: ["quiz", "flashcard", "reading", "chat"] }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  userIdIdx: index("userIdIdx").on(table.userId),
  documentIdIdx: index("documentIdIdx").on(table.documentId),
}));

export type StudySession = typeof studySessions.$inferSelect;
export type InsertStudySession = typeof studySessions.$inferInsert;

// Progress tracking table
export const progressTracking = sqliteTable("progressTracking", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("documentId").notNull(),
  userId: integer("userId").notNull(),
  quizzesAttempted: integer("quizzesAttempted").default(0).notNull(),
  averageQuizScore: real("averageQuizScore").default(0),
  flashcardsCreated: integer("flashcardsCreated").default(0).notNull(),
  flashcardsReviewed: integer("flashcardsReviewed").default(0).notNull(),
  totalStudyTimeMinutes: integer("totalStudyTimeMinutes").default(0).notNull(),
  currentStreak: integer("currentStreak").default(0).notNull(),
  longestStreak: integer("longestStreak").default(0).notNull(),
  lastStudyDate: integer("lastStudyDate", { mode: "timestamp_ms" }),
  lastActivityAt: integer("lastActivityAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  documentIdIdx: index("documentIdIdx").on(table.documentId),
  userIdIdx: index("userIdIdx").on(table.userId),
}));

export type ProgressTracking = typeof progressTracking.$inferSelect;
export type InsertProgressTracking = typeof progressTracking.$inferInsert;

/** A learner's preferred daily study target, kept independent of individual documents. */
export const learningGoals = sqliteTable("learningGoals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  dailyStudyMinutes: integer("dailyStudyMinutes").default(30).notNull(),
  dailyFlashcards: integer("dailyFlashcards").default(10).notNull(),
  dailyQuizzes: integer("dailyQuizzes").default(1).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({ userIdx: index("learning_goals_user_idx").on(table.userId) }));

// Lecturer courses
export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lecturerId: integer("lecturerId").notNull(),
  title: text("title").notNull(),
  code: text("code").notNull().unique(),
  subject: text("subject"),
  description: text("description"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  lecturerIdIdx: index("courses_lecturerId_idx").on(table.lecturerId),
}));

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

export const courseEnrollments = sqliteTable("courseEnrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("courseId").notNull(),
  studentId: integer("studentId").notNull(),
  enrolledAt: integer("enrolledAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  courseIdIdx: index("enrollments_courseId_idx").on(table.courseId),
  studentIdIdx: index("enrollments_studentId_idx").on(table.studentId),
}));

export type CourseEnrollment = typeof courseEnrollments.$inferSelect;
export type InsertCourseEnrollment = typeof courseEnrollments.$inferInsert;

export const assignments = sqliteTable("assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("courseId").notNull(),
  lecturerId: integer("lecturerId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: integer("dueDate", { mode: "timestamp_ms" }),
  documentId: integer("documentId"),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  fileName: text("fileName"),
  fileSize: integer("fileSize"),
  mimeType: text("mimeType"),
  /** Rubric criteria, e.g. [{ criterion, maxPoints }]. */
  rubric: text("rubric", { mode: "json" }).$type<Array<{ criterion: string; maxPoints: number }>>(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  courseIdIdx: index("assignments_courseId_idx").on(table.courseId),
}));

export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("courseId").notNull(),
  lecturerId: integer("lecturerId").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  courseIdIdx: index("announcements_courseId_idx").on(table.courseId),
}));

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

// ── Assignment submissions ────────────────────────────────────────────────────
export const assignmentSubmissions = sqliteTable("assignmentSubmissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignmentId: integer("assignmentId").notNull(),
  studentId: integer("studentId").notNull(),
  courseId: integer("courseId").notNull(),
  /** Optional text note from the student */
  note: text("note"),
  /** If the student uploads a file, its URL is stored here */
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  fileName: text("fileName"),
  fileSize: integer("fileSize"),
  mimeType: text("mimeType"),
  status: text("status", { enum: ["submitted", "late", "graded"] })
    .default("submitted")
    .notNull(),
  /** Grade / feedback from the lecturer */
  grade: text("grade"),
  feedback: text("feedback"),
  rubricScores: text("rubricScores", { mode: "json" }).$type<Array<{ criterion: string; score: number }>>(),
  submittedAt: integer("submittedAt", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
  gradedAt: integer("gradedAt", { mode: "timestamp_ms" }),
}, (table) => ({
  assignmentIdIdx: index("submissions_assignmentId_idx").on(table.assignmentId),
  studentIdIdx: index("submissions_studentId_idx").on(table.studentId),
}));

export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type InsertAssignmentSubmission = typeof assignmentSubmissions.$inferInsert;

/** Lecturer-owned reusable assignment briefs and marking rubrics. */
export const assessmentTemplates = sqliteTable("assessmentTemplates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lecturerId: integer("lecturerId").notNull(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  rubric: text("rubric", { mode: "json" }).$type<Array<{ criterion: string; maxPoints: number }>>(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({ lecturerIdx: index("assessment_templates_lecturer_idx").on(table.lecturerId) }));

// ── General AI chat messages (Ask AI tab — not tied to a document) ────────────
export const generalChatMessages = sqliteTable("generalChatMessages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
}, (table) => ({
  generalChatUserIdIdx: index("generalChat_userId_idx").on(table.userId),
}));

export type GeneralChatMessage = typeof generalChatMessages.$inferSelect;
export type InsertGeneralChatMessage = typeof generalChatMessages.$inferInsert;

// ── Notification inbox ────────────────────────────────────────────────────────
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  /** JSON metadata — e.g. { type: "announcement", courseId: 3 } */
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
  isRead: integer("isRead", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
}, (table) => ({
  notifUserIdIdx: index("notifications_userId_idx").on(table.userId),
  notifIsReadIdx: index("notifications_isRead_idx").on(table.isRead),
}));

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ── Password reset tokens (in-DB, not in-memory — survives server restarts) ──
export const passwordResetTokens = sqliteTable("passwordResetTokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("usedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
}, (table) => ({
  resetTokenIdx: index("resetToken_token_idx").on(table.token),
  resetUserIdIdx: index("resetToken_userId_idx").on(table.userId),
}));

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/** Append-only record of privileged actions. Never update or delete these rows. */
export const adminAuditLogs = sqliteTable("adminAuditLogs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  adminId: integer("adminId").notNull(),
  action: text("action").notNull(),
  targetType: text("targetType").notNull(),
  targetId: integer("targetId").notNull(),
  reason: text("reason"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  adminCreatedIdx: index("admin_audit_admin_created_idx").on(table.adminId, table.createdAt),
  targetIdx: index("admin_audit_target_idx").on(table.targetType, table.targetId),
}));

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

/** Operational errors surfaced in the admin dashboard (AI, indexing, auth, etc.). */
export const systemEvents = sqliteTable("systemEvents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category", { enum: ["ai", "indexing", "auth", "storage"] }).notNull(),
  severity: text("severity", { enum: ["info", "warning", "error"] }).default("error").notNull(),
  message: text("message").notNull(),
  documentId: integer("documentId"),
  userId: integer("userId"),
  resolvedAt: integer("resolvedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  categoryCreatedIdx: index("system_events_category_created_idx").on(table.category, table.createdAt),
}));

/** Multi-turn learning-agent session (no chain-of-thought stored). */
export const agentSessions = sqliteTable("agentSessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  documentId: integer("documentId"),
  courseId: integer("courseId"),
  intent: text("intent"),
  learningGoal: text("learningGoal"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  agentSessionUserIdx: index("agent_sessions_userId_idx").on(table.userId),
}));

export type AgentSession = typeof agentSessions.$inferSelect;

/** Tool execution metadata for observability — not full prompts. */
export const agentToolRuns = sqliteTable("agentToolRuns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("sessionId"),
  requestId: text("requestId").notNull(),
  userId: integer("userId").notNull(),
  toolName: text("toolName").notNull(),
  workflow: text("workflow"),
  provider: text("provider"),
  success: integer("success", { mode: "boolean" }).notNull(),
  durationMs: integer("durationMs").notNull(),
  retrievalCount: integer("retrievalCount"),
  error: text("error"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  agentToolRequestIdx: index("agent_tool_runs_requestId_idx").on(table.requestId),
  agentToolUserIdx: index("agent_tool_runs_userId_idx").on(table.userId),
}));

export const calendarEvents = sqliteTable("calendarEvents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  type: text("type", { enum: ["exam", "test", "quiz", "study", "other"] }).notNull().default("study"),
  startsAt: integer("startsAt", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("endsAt", { mode: "timestamp_ms" }),
  notes: text("notes"),
  courseId: integer("courseId"),
  reminderMinutes: integer("reminderMinutes").notNull().default(60),
  reminderSentAt: integer("reminderSentAt", { mode: "timestamp_ms" }),
  source: text("source", { enum: ["user", "agent"] }).notNull().default("user"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  calendarUserStartsIdx: index("calendar_events_user_starts_idx").on(table.userId, table.startsAt),
}));

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;
