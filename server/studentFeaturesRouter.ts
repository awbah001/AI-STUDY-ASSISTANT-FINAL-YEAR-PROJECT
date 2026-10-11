import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, studentProcedure } from "./_core/trpc";
import { zText } from "../shared/validation";
import { DISCUSSION_LIMITS } from "../shared/studentFeatures";
import { EXAM_LIMITS } from "./examMarking";
import * as mockExams from "./mockExams";
import * as practice from "./practice";
import * as discussions from "./discussions";
import * as audioRecap from "./audioRecap";

async function rateLimit(userId: number) {
  try {
    const { assertAiRateLimit } = await import("./ai");
    assertAiRateLimit(userId);
  } catch (error) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: error instanceof Error ? error.message : "Too many AI requests. Please wait a moment.",
    });
  }
}

const answersSchema = z.record(z.string().max(20), z.string().max(EXAM_LIMITS.answer)).refine(
  (value) => Object.keys(value).length <= EXAM_LIMITS.questions.max,
  "Too many answers."
);

export const examsRouter = router({
  list: studentProcedure
    .input(z.object({ courseId: z.number().int().positive().optional() }).optional())
    .query(({ ctx, input }) => mockExams.listMockExams(ctx.user.id, input?.courseId)),
  create: studentProcedure
    .input(
      z.object({
        courseId: z.number().int().positive(),
        questionCount: z
          .number()
          .int()
          .min(EXAM_LIMITS.questions.min, `An exam needs at least ${EXAM_LIMITS.questions.min} questions.`)
          .max(EXAM_LIMITS.questions.max, `An exam can have at most ${EXAM_LIMITS.questions.max} questions.`),
        durationMinutes: z
          .number()
          .int()
          .min(EXAM_LIMITS.minutes.min, `Allow at least ${EXAM_LIMITS.minutes.min} minutes.`)
          .max(EXAM_LIMITS.minutes.max, `An exam can last at most ${EXAM_LIMITS.minutes.max} minutes.`),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.user.id);
      return mockExams.createMockExam(ctx.user.id, input);
    }),
  get: studentProcedure
    .input(z.object({ examId: z.number().int().positive() }))
    .query(({ ctx, input }) => mockExams.getMockExam(ctx.user.id, input.examId)),
  saveAnswers: studentProcedure
    .input(z.object({ examId: z.number().int().positive(), answers: answersSchema }))
    .mutation(({ ctx, input }) => mockExams.saveMockExamAnswers(ctx.user.id, input.examId, input.answers)),
  submit: studentProcedure
    .input(z.object({ examId: z.number().int().positive(), answers: answersSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.user.id);
      return mockExams.submitMockExam(ctx.user.id, input.examId, input.answers);
    }),
});

export const practiceRouter = router({
  fromQuiz: studentProcedure
    .input(
      z.object({
        quizId: z.number().int().positive(),
        answers: z.record(z.string().max(20), z.string().max(2000)).optional(),
        reviewAt: z.number().int().positive().optional(),
      })
    )
    .mutation(({ ctx, input }) => practice.practiceFromQuiz(ctx.user.id, input)),
  fromExam: studentProcedure
    .input(z.object({ examId: z.number().int().positive(), reviewAt: z.number().int().positive().optional() }))
    .mutation(({ ctx, input }) => practice.practiceFromExam(ctx.user.id, input)),
});

export const discussionsRouter = router({
  list: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(({ ctx, input }) => discussions.listThreads(ctx.user, input.courseId)),
  get: protectedProcedure
    .input(z.object({ threadId: z.number().int().positive() }))
    .query(({ ctx, input }) => discussions.getThread(ctx.user, input.threadId)),
  create: protectedProcedure
    .input(
      z.object({
        courseId: z.number().int().positive(),
        title: zText("Question title", DISCUSSION_LIMITS.title),
        body: zText("Question details", DISCUSSION_LIMITS.body),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "user") await rateLimit(ctx.user.id);
      return discussions.createThread(ctx.user, input);
    }),
  reply: protectedProcedure
    .input(z.object({ threadId: z.number().int().positive(), body: zText("Reply", DISCUSSION_LIMITS.reply) }))
    .mutation(({ ctx, input }) => discussions.replyToThread(ctx.user, input)),
  endorse: protectedProcedure
    .input(
      z.object({
        threadId: z.number().int().positive(),
        replyId: z.number().int().positive().optional(),
        endorsed: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => discussions.endorseAnswer(ctx.user, input)),
  retryAi: protectedProcedure
    .input(z.object({ threadId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.user.id);
      return discussions.retryAiAnswer(ctx.user, input.threadId);
    }),
  deleteThread: protectedProcedure
    .input(z.object({ threadId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => discussions.deleteThread(ctx.user, input.threadId)),
  deleteReply: protectedProcedure
    .input(z.object({ replyId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => discussions.deleteReply(ctx.user, input.replyId)),
});

export const audioRecapRouter = router({
  get: protectedProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .query(({ ctx, input }) => audioRecap.getRecap(ctx.user.id, input.documentId)),
  generate: protectedProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.user.id);
      return audioRecap.generateRecap(ctx.user.id, input.documentId);
    }),
});
