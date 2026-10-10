import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getDb } from "./db";
import {
  getStudentEnrolledCourses,
  getStudentEnrolledCourseQuizzes,
} from "./lecturerQueries";

vi.mock("./db", () => ({ getDb: vi.fn() }));

describe("student presentation uses the student's own records", () => {
  let client: Client;
  beforeEach(async () => {
    client = createClient({ url: "file::memory:" });
    vi.mocked(getDb).mockResolvedValue(
      drizzle(client) as Awaited<ReturnType<typeof getDb>>
    );
    await client.executeMultiple(`
      CREATE TABLE users (id INTEGER, name TEXT);
      CREATE TABLE courses (id INTEGER, title TEXT, subject TEXT, code TEXT, description TEXT, lecturerId INTEGER);
      CREATE TABLE courseEnrollments (studentId INTEGER, courseId INTEGER, enrolledAt INTEGER);
      CREATE TABLE documents (id INTEGER, courseId INTEGER, title TEXT);
      CREATE TABLE progressTracking (documentId INTEGER, userId INTEGER, flashcardsReviewed INTEGER, quizzesAttempted INTEGER, totalStudyTimeMinutes INTEGER);
      CREATE TABLE quizzes (id INTEGER, userId INTEGER, title TEXT, totalQuestions INTEGER, documentId INTEGER, createdAt INTEGER);
      CREATE TABLE studentActivities (userId INTEGER, type TEXT, metadata TEXT, createdAt INTEGER);
      INSERT INTO users VALUES (10,'Lecturer');
      INSERT INTO courses VALUES (1,'Course one','Science','ABC123','Description',10),(2,'Private course','Science','XYZ123','Description',10);
      INSERT INTO courseEnrollments VALUES (1,1,1000),(2,1,1000),(2,2,1000);
      INSERT INTO documents VALUES (1,1,'First material'),(2,1,'Unopened material'),(3,2,'Private material');
      INSERT INTO progressTracking VALUES (1,1,10,1,30),(1,2,0,0,0);
      INSERT INTO quizzes VALUES (1,10,'Shared quiz',5,1,1000),(2,2,'Another student quiz',5,1,1000),(3,10,'Private course quiz',5,3,1000);
      INSERT INTO studentActivities VALUES (1,'QUIZ_COMPLETED','{"quizId":1,"score":50}',1000),(1,'QUIZ_COMPLETED','{"quizId":1,"score":80}',2000);
    `);
  });
  afterEach(() => client.close());

  it("includes unstudied materials in course progress and excludes other students' activity", async () => {
    const first = await getStudentEnrolledCourses(1);
    expect(first).toHaveLength(1);
    expect(first[0].progressPct).toBe(50);
    const second = await getStudentEnrolledCourses(2);
    expect(second.every(c => c.progressPct === 0)).toBe(true);
  });

  it("uses the latest personal attempt for shared quizzes without leaking it to classmates", async () => {
    const first = await getStudentEnrolledCourseQuizzes(1);
    expect(first.map(q => q.id)).toEqual([1]);
    expect(first[0].score).toBe(80);
    expect(first[0].completedAt?.getTime()).toBe(2000);
    const second = await getStudentEnrolledCourseQuizzes(2);
    expect(second.find(q => q.id === 1)?.completedAt).toBeNull();
    expect(second.find(q => q.id === 1)?.score).toBeNull();
  });

  it("returns empty collections for students without enrollments", async () => {
    expect(await getStudentEnrolledCourses(999)).toEqual([]);
    expect(await getStudentEnrolledCourseQuizzes(999)).toEqual([]);
  });
});
