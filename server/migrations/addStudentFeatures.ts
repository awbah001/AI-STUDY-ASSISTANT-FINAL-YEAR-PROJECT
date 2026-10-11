import type { Client } from "@libsql/client";

export async function runStudentFeaturesMigration(client: Client) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS mockExams (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      userId integer NOT NULL,
      courseId integer NOT NULL,
      title text NOT NULL,
      durationMinutes integer NOT NULL,
      questionCount integer NOT NULL,
      status text NOT NULL DEFAULT 'in_progress',
      startedAt integer NOT NULL,
      deadlineAt integer NOT NULL,
      submittedAt integer,
      totalMarks real NOT NULL DEFAULT 0,
      earnedMarks real,
      scorePercent real,
      practiceCreatedAt integer,
      createdAt integer NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS mock_exams_user_course_idx ON mockExams (userId, courseId)`,
    `CREATE TABLE IF NOT EXISTS mockExamQuestions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      examId integer NOT NULL,
      position integer NOT NULL,
      type text NOT NULL,
      question text NOT NULL,
      options text,
      correctAnswer text NOT NULL,
      keyPoints text,
      explanation text,
      documentId integer,
      topic text,
      marks real NOT NULL,
      userAnswer text,
      awardedMarks real,
      isCorrect integer,
      feedback text
    )`,
    `CREATE INDEX IF NOT EXISTS mock_exam_questions_exam_idx ON mockExamQuestions (examId)`,
    `CREATE TABLE IF NOT EXISTS courseDiscussions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      courseId integer NOT NULL,
      authorId integer NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      aiAnswer text,
      aiStatus text NOT NULL DEFAULT 'none',
      aiSources text,
      aiEndorsed integer NOT NULL DEFAULT 0,
      replyCount integer NOT NULL DEFAULT 0,
      lastActivityAt integer NOT NULL,
      createdAt integer NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS course_discussions_course_activity_idx ON courseDiscussions (courseId, lastActivityAt)`,
    `CREATE TABLE IF NOT EXISTS courseDiscussionReplies (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      threadId integer NOT NULL,
      authorId integer NOT NULL,
      body text NOT NULL,
      isEndorsed integer NOT NULL DEFAULT 0,
      createdAt integer NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS course_discussion_replies_thread_idx ON courseDiscussionReplies (threadId)`,
    `CREATE TABLE IF NOT EXISTS audioRecaps (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      documentId integer NOT NULL UNIQUE,
      script text NOT NULL,
      audioUrl text,
      audioBytes integer,
      durationSeconds integer,
      voice text,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    )`,
  ];
  for (const sql of statements) {
    await client.execute(sql);
  }
}
