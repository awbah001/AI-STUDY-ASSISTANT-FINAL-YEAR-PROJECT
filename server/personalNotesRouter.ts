import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  personalNotes,
  chatMessages,
  generalChatMessages,
  courses,
  courseEnrollments,
} from "../drizzle/schema";
import { router, studentProcedure } from "./_core/trpc";
import { getDb } from "./db";

const fields = {
  courseId: z.number().int().positive().nullable().optional(),
  topic: z.string().trim().max(100).optional(),
  collection: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(50000),
};
async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable.",
    });
  return db;
}
function missing(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "Note unavailable." });
}
async function requireEnrolledCourse(
  userId: number,
  courseId: number | null | undefined
) {
  if (!courseId) return;
  const db = await database();
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .innerJoin(courseEnrollments, eq(courseEnrollments.courseId, courses.id))
    .where(
      and(
        eq(courseEnrollments.studentId, userId),
        eq(courses.id, courseId),
        eq(courses.isActive, true)
      )
    )
    .limit(1);
  if (!course)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Choose an active course you are enrolled in.",
    });
}

export const personalNotesRouter = router({
  organization: studentProcedure.query(async ({ ctx }) => {
    const db = await database();
    const available = await db
      .select({ id: courses.id, title: courses.title, code: courses.code })
      .from(courses)
      .innerJoin(courseEnrollments, eq(courseEnrollments.courseId, courses.id))
      .where(
        and(
          eq(courseEnrollments.studentId, ctx.user.id),
          eq(courses.isActive, true)
        )
      )
      .orderBy(asc(courses.title));
    const owned = await db
      .select({
        topic: personalNotes.topic,
        collection: personalNotes.collection,
        courseId: personalNotes.courseId,
      })
      .from(personalNotes)
      .where(eq(personalNotes.userId, ctx.user.id));
    const unique = (values: string[]) =>
      [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      courses: available,
      linkedCourseIds: [
        ...new Set(owned.flatMap(n => (n.courseId ? [n.courseId] : []))),
      ],
      topics: unique(owned.map(n => n.topic)),
      collections: unique(owned.map(n => n.collection)),
    };
  }),
  list: studentProcedure
    .input(
      z.object({
        search: z.string().trim().max(200).default(""),
        offset: z.number().int().min(0).default(0),
        order: z.enum(["latest", "oldest", "title"]).default("latest"),
        courseId: z.number().int().min(0).optional(),
        topic: z.string().trim().max(100).optional(),
        collection: z.string().trim().max(80).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await database();
      // Parameter binding plus literal wildcard escaping keeps search text literal.
      const pattern = `%${input.search.replace(/[!%_]/g, "!$&")}%`;
      const filter = and(
        eq(personalNotes.userId, ctx.user.id),
        input.courseId === undefined
          ? undefined
          : input.courseId === 0
            ? isNull(personalNotes.courseId)
            : eq(personalNotes.courseId, input.courseId),
        input.topic === undefined
          ? undefined
          : eq(personalNotes.topic, input.topic),
        input.collection === undefined
          ? undefined
          : eq(personalNotes.collection, input.collection),
        input.search
          ? or(
              sql`${personalNotes.title} LIKE ${pattern} ESCAPE '!'`,
              sql`${personalNotes.body} LIKE ${pattern} ESCAPE '!'`,
              sql`${personalNotes.tags} LIKE ${pattern} ESCAPE '!'`,
              sql`${personalNotes.topic} LIKE ${pattern} ESCAPE '!'`,
              sql`${personalNotes.collection} LIKE ${pattern} ESCAPE '!'`
            )
          : undefined
      );
      const rows = await db
        .select()
        .from(personalNotes)
        .where(filter)
        .orderBy(
          input.order === "title"
            ? asc(personalNotes.title)
            : input.order === "oldest"
              ? asc(personalNotes.updatedAt)
              : desc(personalNotes.updatedAt),
          desc(personalNotes.id)
        )
        .limit(51)
        .offset(input.offset);
      const [result] = await db
        .select({ total: count() })
        .from(personalNotes)
        .where(filter);
      return {
        items: rows.slice(0, 50),
        hasMore: rows.length > 50,
        total: result.total,
      };
    }),
  create: studentProcedure
    .input(z.object({ ...fields, requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const key = `manual:${input.requestId}`;
      await requireEnrolledCourse(ctx.user.id, input.courseId);
      const values = {
        userId: ctx.user.id,
        title: input.title,
        body: input.body,
        tags: input.tags,
        courseId: input.courseId,
        topic: input.topic,
        collection: input.collection,
        sourceKey: key,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const [row] = await db
        .insert(personalNotes)
        .values(values)
        .onConflictDoNothing()
        .returning();
      if (row) return row;
      const [existing] = await db
        .select()
        .from(personalNotes)
        .where(
          and(
            eq(personalNotes.userId, ctx.user.id),
            eq(personalNotes.sourceKey, key)
          )
        );
      if (!existing) missing();
      if (
        existing.title !== input.title ||
        existing.body !== input.body ||
        (input.courseId !== undefined &&
          existing.courseId !== input.courseId) ||
        (input.topic !== undefined && existing.topic !== input.topic) ||
        (input.collection !== undefined &&
          existing.collection !== input.collection) ||
        (input.tags !== undefined &&
          JSON.stringify(existing.tags) !== JSON.stringify(input.tags))
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "This save request has already been used.",
        });
      return existing;
    }),
  update: studentProcedure
    .input(
      z.object({
        ...fields,
        id: z.number().int().positive(),
        version: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      if (input.courseId !== undefined) {
        const [owned] = await db
          .select({ courseId: personalNotes.courseId })
          .from(personalNotes)
          .where(
            and(
              eq(personalNotes.id, input.id),
              eq(personalNotes.userId, ctx.user.id)
            )
          );
        if (!owned) missing();
        if (input.courseId !== owned.courseId)
          await requireEnrolledCourse(ctx.user.id, input.courseId);
      }
      const [row] = await db
        .update(personalNotes)
        .set({
          title: input.title,
          body: input.body,
          tags: input.tags,
          courseId: input.courseId,
          topic: input.topic,
          collection: input.collection,
          updatedAt: new Date(),
          version: sql`${personalNotes.version}+1`,
        })
        .where(
          and(
            eq(personalNotes.id, input.id),
            eq(personalNotes.userId, ctx.user.id),
            eq(personalNotes.version, input.version)
          )
        )
        .returning();
      if (row) return row;
      const [existing] = await db
        .select({ id: personalNotes.id })
        .from(personalNotes)
        .where(
          and(
            eq(personalNotes.id, input.id),
            eq(personalNotes.userId, ctx.user.id)
          )
        );
      if (!existing) missing();
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "This note changed in another window. Reload it before saving.",
      });
    }),
  remove: studentProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        version: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const [row] = await db
        .delete(personalNotes)
        .where(
          and(
            eq(personalNotes.id, input.id),
            eq(personalNotes.userId, ctx.user.id),
            eq(personalNotes.version, input.version)
          )
        )
        .returning({ id: personalNotes.id });
      if (!row)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Note unavailable or changed. Refresh your notes.",
        });
      return { id: row.id };
    }),
  saveResponse: studentProcedure
    .input(
      z.object({
        documentId: z.number().int().min(0),
        content: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const channel = input.documentId
        ? ("document" as const)
        : ("general" as const);
      const table = input.documentId ? chatMessages : generalChatMessages;
      // Copy only a response that actually exists in this student's own history.
      const [message] = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.userId, ctx.user.id),
            eq(table.role, "assistant"),
            eq(table.content, input.content),
            input.documentId
              ? eq(chatMessages.documentId, input.documentId)
              : undefined
          )
        )
        .orderBy(desc(table.id))
        .limit(1);
      if (!message)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This response is not in your saved conversation history.",
        });
      const key = `${channel}:${message.id}`;
      const [row] = await db
        .insert(personalNotes)
        .values({
          userId: ctx.user.id,
          title:
            message.content
              .replace(/[#*`\[\]]/g, "")
              .split("\n")
              .find(line => line.trim())
              ?.slice(0, 160) || "Saved AI response",
          body: message.content,
          sourceKey: key,
          sourceMessageId: message.id,
          sourceChannel: channel,
          documentId: input.documentId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();
      if (row) return row;
      const [existing] = await db
        .select()
        .from(personalNotes)
        .where(
          and(
            eq(personalNotes.userId, ctx.user.id),
            eq(personalNotes.sourceKey, key)
          )
        );
      return existing!;
    }),
});
