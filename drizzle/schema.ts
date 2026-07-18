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
    enum: ["notes", "pdf", "slides", "assignment", "other"],
  }).default("other"),
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
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
}, (table) => ({
  documentIdIdx: index("documentIdIdx").on(table.documentId),
  userIdIdx: index("userIdIdx").on(table.userId),
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
