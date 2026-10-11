import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { CalendarCheck, CalendarPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  fromLocalParts,
  looksLikeStudyPlan,
  PLAN_LIMITS,
  PLAN_SAVED_PATTERN,
  PLAN_SESSION_TYPES,
  planSessionError,
  toLocalParts,
  type PlanSessionDraft,
  type PlanSessionType,
} from "@shared/studyPlan";

const chip =
  "inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-accent hover:text-foreground";
const cell = "h-9 rounded-md px-2 text-sm";
const typeLabel: Record<PlanSessionType, string> = {
  study: "Study",
  quiz: "Quiz",
  test: "Test",
  exam: "Exam",
  other: "Other",
};

const clampMinutes = (value: number) =>
  Math.min(PLAN_LIMITS.duration.max, Math.max(PLAN_LIMITS.duration.min, Math.round(value) || 60));

function blankRow(rows: PlanSessionDraft[], tzOffset: number): PlanSessionDraft {
  const last = rows[rows.length - 1];
  const base = last ? fromLocalParts(last.date, last.time, tzOffset) : null;
  const next = toLocalParts((base ?? Date.now()) + 24 * 60 * 60 * 1000, tzOffset);
  return {
    title: "",
    type: "study",
    date: next.date,
    time: last?.time || "18:00",
    durationMinutes: last?.durationMinutes || 60,
    notes: "",
  };
}

/** "Add to study planner" chip for an Ask AI reply, with an editable preview before saving. */
export function AddPlanToPlanner({ content }: { content: string }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PlanSessionDraft[]>([]);
  const [tzOffset] = useState(() => new Date().getTimezoneOffset());
  const [saved, setSaved] = useState(false);

  const draft = trpc.planner.draftFromText.useMutation({
    onSuccess: data => {
      setRows(data.sessions);
      setOpen(true);
    },
    onError: error => toast.error(error.message),
  });
  const save = trpc.planner.savePlan.useMutation({
    onSuccess: async data => {
      await utils.planner.invalidate();
      setSaved(true);
      setOpen(false);
      toast.success(`Added ${data.created} session${data.created === 1 ? "" : "s"} to your study planner.`);
    },
    onError: error => toast.error(error.message),
  });

  if (PLAN_SAVED_PATTERN.test(content) || saved) {
    return (
      <Link href="/student/planner" className={`${chip} text-primary`}>
        <CalendarCheck className="size-3.5" />
        Open planner
      </Link>
    );
  }
  if (!looksLikeStudyPlan(content)) return null;

  const errors = rows.map(row => planSessionError(row, tzOffset));
  const firstError = errors.findIndex(Boolean);
  const update = (index: number, patch: Partial<PlanSessionDraft>) =>
    setRows(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const confirm = () => {
    if (!rows.length) return toast.error("Add at least one session.");
    if (firstError >= 0) return toast.error(`Row ${firstError + 1}: ${errors[firstError]}`);
    save.mutate({
      sessions: rows.map(row => ({
        title: row.title.trim(),
        type: row.type,
        startsAt: fromLocalParts(row.date, row.time, tzOffset)!,
        durationMinutes: clampMinutes(row.durationMinutes),
        notes: row.notes.trim() || undefined,
      })),
    });
  };

  return (
    <>
      <button
        type="button"
        className={chip}
        disabled={draft.isPending}
        title="Turn this plan into planner sessions"
        onClick={() => {
          if (rows.length) setOpen(true);
          else draft.mutate({ text: content.slice(0, PLAN_LIMITS.text.max), timezoneOffset: tzOffset });
        }}
      >
        {draft.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarPlus className="size-3.5" />}
        {draft.isPending ? "Reading plan..." : "Add to study planner"}
      </button>

      <Dialog open={open} onOpenChange={next => !save.isPending && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add this plan to your study planner</DialogTitle>
            <DialogDescription>
              Check the sessions below. Change anything you like, remove what you don't need, then save. You'll get a
              reminder before each session.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 w-10">#</th>
                  <th className="px-2 py-2">Session</th>
                  <th className="px-2 py-2 w-28">Type</th>
                  <th className="px-2 py-2 w-40">Date</th>
                  <th className="px-2 py-2 w-28">Time</th>
                  <th className="px-2 py-2 w-24">Minutes</th>
                  <th className="px-2 py-2">What to do</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t align-top">
                    <td className="px-2 py-2 text-muted-foreground">{index + 1}</td>
                    <td className="px-2 py-2">
                      <Input
                        className={cell}
                        value={row.title}
                        maxLength={PLAN_LIMITS.title.max}
                        aria-label={`Session ${index + 1} title`}
                        aria-invalid={Boolean(errors[index])}
                        onChange={e => update(index, { title: e.target.value })}
                      />
                      {errors[index] && <p className="mt-1 text-xs text-destructive">{errors[index]}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className={`${cell} w-full border bg-background`}
                        value={row.type}
                        aria-label={`Session ${index + 1} type`}
                        onChange={e => update(index, { type: e.target.value as PlanSessionType })}
                      >
                        {PLAN_SESSION_TYPES.map(type => (
                          <option key={type} value={type}>
                            {typeLabel[type]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="date"
                        className={cell}
                        value={row.date}
                        min={toLocalParts(Date.now(), tzOffset).date}
                        aria-label={`Session ${index + 1} date`}
                        onChange={e => update(index, { date: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="time"
                        className={cell}
                        value={row.time}
                        aria-label={`Session ${index + 1} time`}
                        onChange={e => update(index, { time: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        className={cell}
                        min={PLAN_LIMITS.duration.min}
                        max={PLAN_LIMITS.duration.max}
                        step={5}
                        value={row.durationMinutes}
                        aria-label={`Session ${index + 1} minutes`}
                        onChange={e => update(index, { durationMinutes: Number(e.target.value) || 0 })}
                        onBlur={() => update(index, { durationMinutes: clampMinutes(row.durationMinutes) })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        className={cell}
                        value={row.notes}
                        maxLength={PLAN_LIMITS.notes}
                        placeholder="Optional"
                        aria-label={`Session ${index + 1} notes`}
                        onChange={e => update(index, { notes: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-9 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove session ${index + 1}`}
                        onClick={() => setRows(current => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      No sessions left. Add one or close this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={rows.length >= PLAN_LIMITS.sessions}
            onClick={() => setRows(current => [...current, blankRow(current, tzOffset)])}
          >
            <Plus className="size-4" />
            Add session
          </Button>

          <DialogFooter>
            <Button variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending || !rows.length || firstError >= 0} onClick={confirm}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
              Save {rows.length} session{rows.length === 1 ? "" : "s"} to planner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
