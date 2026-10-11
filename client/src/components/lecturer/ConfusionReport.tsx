import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Lightbulb, Loader2, MessageCircleQuestion, RefreshCw, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { INSIGHT_PERIODS, type ConfusionTopic, type InsightPeriod } from "@shared/lecturerInsights";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function TopicCard({ topic, rank, max }: { topic: ConfusionTopic; rank: number; max: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-900">{topic.topic}</p>
            <p className="text-xs text-slate-500">
              {topic.questionCount} question{topic.questionCount === 1 ? "" : "s"} · {topic.studentCount} student{topic.studentCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(8, (topic.questionCount / max) * 100)}%` }} />
          </div>
          {topic.summary && <p className="mt-2 text-sm text-slate-600">{topic.summary}</p>}
          {topic.suggestion && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              {topic.suggestion}
            </p>
          )}
          {topic.examples.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
              >
                {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Example questions
              </button>
              {open && (
                <ul className="mt-2 space-y-1">
                  {topic.examples.map(example => (
                    <li key={example} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs italic text-slate-600">
                      “{example}”
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** "What's confusing my class": students' recent questions grouped into topics, without names. */
export function ConfusionReport({ courseId }: { courseId: number }) {
  const [days, setDays] = useState<InsightPeriod>(7);
  const utils = trpc.useUtils();
  const report = trpc.lecturer.ai.confusionReport.useQuery({ courseId }, { enabled: courseId > 0 });
  const generate = trpc.lecturer.ai.generateConfusionReport.useMutation({
    onSuccess: data => {
      utils.lecturer.ai.confusionReport.setData({ courseId }, data);
      toast.success("Class insights updated.");
    },
    onError: error => toast.error(error.message),
  });
  const data = report.data;
  const stale = data ? Date.now() - new Date(data.createdAt).getTime() > WEEK_MS : false;
  const max = Math.max(1, ...(data?.topics ?? []).map(t => t.questionCount));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
            <MessageCircleQuestion className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">What's confusing my class</p>
            <p className="text-xs text-slate-500">Topics students ask the AI and the discussion board about most</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Period">
            {INSIGHT_PERIODS.map(value => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={days === value}
                onClick={() => setDays(value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${days === value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {value} days
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={generate.isPending}
            onClick={() => generate.mutate({ courseId, days })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {generate.isPending ? "Analysing…" : data ? "Refresh" : "Build report"}
          </button>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {report.isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : !data ? (
          <p className="text-sm text-slate-500">
            No report yet. Build one to see which topics your students are asking about most, so you know what to go over again.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              {data.questionCount} question{data.questionCount === 1 ? "" : "s"} from {data.studentCount} student
              {data.studentCount === 1 ? "" : "s"} · {new Date(data.periodStart).toLocaleDateString()} to{" "}
              {new Date(data.periodEnd).toLocaleDateString()}
              {stale && <span className="ml-2 font-semibold text-amber-600">Over a week old. Refresh for the latest.</span>}
            </p>
            {data.topics.length ? (
              <div className="space-y-3">
                {data.topics.map((topic, index) => (
                  <TopicCard key={topic.topic} topic={topic} rank={index + 1} max={max} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">
                {data.questionCount < 3
                  ? "Not enough questions in this period yet. Try a longer period, or check back once students have used the AI more."
                  : "No clear pattern in this period's questions."}
              </p>
            )}
          </>
        )}
        <p className="flex gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Anonymised: names are never shown or sent to the AI, and emails and phone numbers are removed from questions.
        </p>
      </div>
    </div>
  );
}
