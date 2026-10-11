import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { lecturerProcedure, router } from "./_core/trpc";
import * as lecturerAi from "./lecturerAi";
import { INSIGHT_PERIODS } from "../shared/lecturerInsights";

async function aiRateLimit(userId: number) {
  try {
    const { assertAiRateLimit } = await import("./ai");
    assertAiRateLimit(userId);
  } catch (error) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error instanceof Error ? error.message : "Too many AI requests." });
  }
}

const id = z.number().int().positive();

export const lecturerAiRouter = router({
  /** AI-suggested rubric scores and feedback; the lecturer edits them and saves with gradeSubmission. */
  draftGrade: lecturerProcedure
    .input(z.object({ submissionId: id, regenerate: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await lecturerAi.draftGrade(ctx.user.id, input.submissionId, input.regenerate, () => aiRateLimit(ctx.user.id));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.warn("[lecturer-ai] Grade draft failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The AI couldn't draft a grade right now. Please try again." });
      }
    }),

  similarity: lecturerProcedure
    .input(z.object({ assignmentId: id }))
    .mutation(({ ctx, input }) => lecturerAi.checkSimilarity(ctx.user.id, input.assignmentId)),

  confusionReport: lecturerProcedure
    .input(z.object({ courseId: id }))
    .query(({ ctx, input }) => lecturerAi.latestConfusionReport(ctx.user.id, input.courseId)),

  generateConfusionReport: lecturerProcedure
    .input(
      z.object({
        courseId: id,
        days: z.number().int().refine((d) => (INSIGHT_PERIODS as readonly number[]).includes(d), "Choose 7, 14 or 30 days."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await aiRateLimit(ctx.user.id);
      return lecturerAi.generateConfusionReport(ctx.user.id, input.courseId, input.days);
    }),
});
