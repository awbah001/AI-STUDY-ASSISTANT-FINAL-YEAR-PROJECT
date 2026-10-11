import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Copy, Loader2, ScanSearch, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { SIMILARITY_LABEL, similarityLevel, type SimilarityLevel } from "@shared/lecturerInsights";

const levelStyle: Record<SimilarityLevel, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

function LevelBadge({ percent }: { percent: number }) {
  const level = similarityLevel(percent);
  if (!level) return <span className="text-xs text-slate-400">{percent}%</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${levelStyle[level]}`}>
      {percent}% · {SIMILARITY_LABEL[level]}
    </span>
  );
}

function Passages({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((p, i) => (
        <blockquote key={i} className="border-l-2 border-slate-300 bg-slate-50 px-3 py-1.5 text-xs italic text-slate-600">
          “{p}”
        </blockquote>
      ))}
    </div>
  );
}

/** Runs the check when opened and lists pairs of submissions that share wording. */
export function SimilarityDialog({
  assignmentId,
  title,
  open,
  onOpenChange,
}: {
  assignmentId: number | null;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const check = trpc.lecturer.ai.similarity.useMutation({ onError: error => toast.error(error.message) });
  const { mutate, reset } = check;
  useEffect(() => {
    if (open && assignmentId) mutate({ assignmentId });
    if (!open) reset();
  }, [open, assignmentId, mutate, reset]);
  const data = check.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-indigo-600" />
            Similarity check{title ? `: ${title}` : ""}
          </DialogTitle>
          <DialogDescription>
            Compares every submission word for word, ignoring text copied from the brief. Overlap is a reason to look closer, not proof
            of copying: shared quotes, references or group work can explain it.
          </DialogDescription>
        </DialogHeader>

        {check.isPending ? (
          <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading and comparing submissions…
          </div>
        ) : !data ? null : (
          <div className="space-y-5">
            <p className="text-xs text-slate-500">
              {data.submissions.length} submission{data.submissions.length === 1 ? "" : "s"} checked ·{" "}
              {new Date(data.checkedAt).toLocaleString()}
            </p>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Users className="h-4 w-4" /> Between students
              </h3>
              {data.pairs.length ? (
                <div className="space-y-2">
                  {data.pairs.map(pair => (
                    <div key={`${pair.a.submissionId}-${pair.b.submissionId}`} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {pair.a.studentName} <span className="text-slate-400">and</span> {pair.b.studentName}
                        </p>
                        <LevelBadge percent={pair.percent} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {pair.percent}% of the shorter submission appears word for word in the other.
                      </p>
                      <Passages items={pair.passages} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">
                  No noticeable shared wording between submissions.
                </p>
              )}
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <BookOpen className="h-4 w-4" /> Each submission
              </h3>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Words</th>
                      <th className="px-3 py-2">Copied from course notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.submissions.map(s => (
                      <tr key={s.submissionId} className="border-t align-top">
                        <td className="px-3 py-2 font-medium text-slate-900">{s.studentName}</td>
                        <td className="px-3 py-2 text-slate-600">{s.words.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          {s.comparable ? (
                            <>
                              <LevelBadge percent={s.notesPercent} />
                              <Passages items={s.notesPassages} />
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Too short or not readable (scan or photo)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Pick an assignment and check its submissions. */
export function SimilarityPanel({ assignments }: { assignments: Array<{ id: number; title: string }> }) {
  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const current = assignmentId ?? assignments[0]?.id ?? null;
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Copy className="h-5 w-5 text-indigo-600" />
        <h2 className="font-semibold">Similarity check</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">Spot submissions that share wording with each other or with your notes.</p>
      {assignments.length ? (
        <div className="flex gap-2">
          <select
            value={current ?? ""}
            onChange={e => setAssignmentId(Number(e.target.value))}
            className="h-9 min-w-0 flex-1 rounded-lg border px-2 text-sm"
            aria-label="Assignment to check"
          >
            {assignments.map(a => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Check
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No submissions to compare yet.</p>
      )}
      <SimilarityDialog
        assignmentId={current}
        title={assignments.find(a => a.id === current)?.title}
        open={open}
        onOpenChange={setOpen}
      />
    </section>
  );
}
