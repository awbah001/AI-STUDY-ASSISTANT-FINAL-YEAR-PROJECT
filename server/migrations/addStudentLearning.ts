import type { Client } from "@libsql/client";

export async function runStudentLearningMigration(client: Client) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS studentProfiles (
      userId integer PRIMARY KEY NOT NULL,
      faculty text,
      department text,
      programme text,
      academicLevel text,
      semester text,
      academicYear text,
      learnModes text,
      focusGoals text,
      onboardingStep text NOT NULL DEFAULT 'welcome',
      onboardingRequired integer NOT NULL DEFAULT 0,
      onboardingCompletedAt integer,
      lastCourseId integer,
      lastDocumentId integer,
      lastQuizId integer,
      updatedAt integer NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS studentActivities (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      userId integer NOT NULL,
      type text NOT NULL,
      courseId integer,
      documentId integer,
      metadata text,
      createdAt integer NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS student_activity_user_created_idx ON studentActivities (userId, createdAt)`,
    `CREATE INDEX IF NOT EXISTS student_activity_user_course_idx ON studentActivities (userId, courseId)`,
  ];
  for (const sql of statements) {
    await client.execute(sql);
  }
  try {
    await client.execute(
      `ALTER TABLE studentProfiles ADD COLUMN onboardingRequired integer NOT NULL DEFAULT 0`
    );
  } catch {
    // Column already exists
  }
  // Existing accounts must not be sent through onboarding.
  await client.execute(
    `UPDATE studentProfiles
     SET onboardingRequired = 0,
         onboardingStep = 'done',
         onboardingCompletedAt = COALESCE(onboardingCompletedAt, updatedAt)
     WHERE onboardingCompletedAt IS NULL
       AND (onboardingRequired = 0 OR onboardingRequired IS NULL)`
  );
}
