import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { GradeDraft } from "@shared/lecturerInsights";

/**
 * "Draft with AI" for the grading form. The suggestion only fills the form; the lecturer
 * still reviews it and presses save before anything reaches the student.
 */
export function AiGradeAssist({
  submissionId,
  existing,
  onApply,
}: {
  submissionId: number;
  existing?: { draft: GradeDraft | null; draftedAt: Date | string | null };
  onApply: (draft: GradeDraft) => void;
}) {
  const [result, setResult] = useState<{ draft: GradeDraft; draftedAt: Date | string | null } | null>(
    existing?.draft ? { draft: existing.draft, draftedAt: existing.draftedAt } : null
  );
  const [showReasons, setShowReasons] = useState(false);
  const utils = trpc.useUtils();
  const draft = trpc.lecturer.ai.draftGrade.useMutation({
    onSuccess: data => {
      setResult(data);
      setShowReasons(true);
      onApply(data.draft);
      void utils.lecturer.assignments.reviewQueue.invalidate();
      toast.success("AI suggestion added. Check it before you save.");
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-violet-800">
          <Sparkles className="h-4 w-4" />
          {result ? "AI suggestion" : "Let the AI suggest marks"}
        </div>
        <div className="flex gap-2">
          {result && (
            <button
              type="button"
              onClick={() => onApply(result.draft)}
              className="rounded-lg border border-violet-300 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
            >
              Use suggestion
            </button>
          )}
          <button
            type="button"
            disabled={draft.isPending}
            onClick={() => draft.mutate({ submissionId, regenerate: Boolean(result) })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {draft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : result ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {draft.isPending ? "Reading submission…" : result ? "Redo" : "Draft with AI"}
          </button>
        </div>
      </div>
      {!result && !draft.isPending && (
        <p className="mt-1.5 text-xs text-violet-900/70">
          The AI reads the submission, the brief and your course notes, then fills in scores and feedback for you to check and edit.
        </p>
      )}
      {result && (
        <>
          <p className="mt-1.5 text-xs text-violet-900/70">
            Suggested {result.draft.total} / {result.draft.maxTotal}
            {result.draftedAt ? ` · ${new Date(result.draftedAt).toLocaleString()}` : ""}. You decide the final mark.
          </p>
          {result.draft.warning && (
            <p className="mt-2 flex gap-1.5 text-xs text-amber-700">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {result.draft.warning}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowReasons(v => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"
          >
            {showReasons ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Why these marks
          </button>
          {showReasons && (
            <ul className="mt-2 space-y-1.5">
              {result.draft.criteria.map(c => (
                <li key={c.criterion} className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {c.criterion}: {c.score} / {c.maxPoints}
                  </span>
                  {c.comment && <span className="block text-slate-600">{c.comment}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
