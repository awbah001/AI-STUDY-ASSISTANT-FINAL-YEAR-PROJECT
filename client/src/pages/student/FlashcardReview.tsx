import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { StudentRing } from "@/components/StudentUi";
import { Link } from "wouter";
import { toast } from "sonner";

/** Uses the same due-card queue and SM-2 ratings as mobile/flashcard-study. */
export default function FlashcardReview({
  documentId,
}: {
  documentId?: number;
}) {
  const query = trpc.flashcards.due.useQuery({ documentId });
  const reducedMotion = useReducedMotion();
  const utils = trpc.useUtils();
  const [reviewed, setReviewed] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const rate = trpc.flashcards.rateCard.useMutation({
    onSuccess: (_, input) => {
      setReviewed(ids => [...ids, input.flashcardId]);
      setRevealed(false);
      void utils.flashcards.invalidate();
      void utils.progress.invalidate();
      void utils.planner.invalidate();
      void utils.studentLearning.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const card = query.data?.find(item => !reviewed.includes(item.id));
  return (
    <section className="student-panel student-flash-review">
      <h2 className="text-lg font-semibold">Due for review</h2>
      <p className="text-sm text-muted-foreground">
        Rate how well you remember each answer. Your next review date is shared
        with the mobile app.
      </p>
      {query.isLoading && <p role="status">Loading due cards...</p>}
      {query.error && (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {card && (
        <>
          <div className="student-review-card space-y-5 rounded-xl bg-emerald-50 p-6 text-emerald-950">
            <p className="text-lg font-semibold">{card.question}</p>
            {revealed ? (
              <motion.p initial={reducedMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: reducedMotion ? 0 : .25 }} className="whitespace-pre-wrap overflow-hidden border-t border-emerald-200 pt-5">
                {card.answer}
              </motion.p>
            ) : (
              <Button variant="outline" onClick={() => setRevealed(true)}>
                Show answer
              </Button>
            )}
          </div>
          <div className="student-review-status">
            <StudentRing
              value={
                (reviewed.length /
                  Math.max(
                    1,
                    reviewed.length +
                      (query.data?.filter(c => !reviewed.includes(c.id))
                        .length || 0)
                  )) *
                100
              }
            />
            <strong>Session progress</strong>
            <p>
              {reviewed.length} reviewed ·{" "}
              {query.data?.filter(c => !reviewed.includes(c.id)).length || 0}{" "}
              cards due
            </p>
            <Link className="text-emerald-700" href="/student/planner">
              Review schedule →
            </Link>
          </div>
          {revealed && (
            <div className="flex flex-wrap gap-3">
              {(["Again", "Hard", "Good", "Easy"] as const).map(
                (label, rating) => (
                  <Button
                    key={label}
                    variant="outline"
                    disabled={rate.isPending}
                    onClick={() =>
                      rate.mutate({
                        flashcardId: card.id,
                        rating: rating as 0 | 1 | 2 | 3,
                      })
                    }
                  >
                    {label}
                  </Button>
                )
              )}
            </div>
          )}
        </>
      )}
      {!card && query.data && (
        <p>
          {reviewed.length
            ? `Session complete. You reviewed ${reviewed.length} cards.`
            : "No cards due right now. Generate flashcards from a document below."}
        </p>
      )}
    </section>
  );
}
