import { useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  ArrowLeft,
  BadgeCheck,
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircleQuestion,
  MessagesSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/lib/formValidation";
import { trpc } from "@/lib/trpc";
import { validateText } from "@shared/validation";
import { DISCUSSION_LIMITS } from "@shared/studentFeatures";

const fail = (error: { message: string }) => toast.error(error.message);

function ago(date: Date | string) {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RoleTag({ role, isLecturer }: { role: string; isLecturer?: boolean }) {
  if (isLecturer) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Lecturer</span>;
  if (role === "admin") return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Admin</span>;
  if (role === "lecturer") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Staff</span>;
  return null;
}

/** Course Q&A: students ask, the AI drafts an answer from course materials, lecturers endorse. */
export function CourseDiscussion({ courseId, initialThreadId }: { courseId: number; initialThreadId?: number }) {
  const [openId, setOpenId] = useState<number | null>(initialThreadId ?? null);
  const [asking, setAsking] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "answered">("all");
  const list = trpc.discussions.list.useQuery({ courseId });

  if (openId) return <DiscussionThread threadId={openId} onBack={() => setOpenId(null)} />;

  const threads = list.data?.threads.filter((t) => (filter === "all" ? true : filter === "answered" ? t.resolved : !t.resolved));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="student-tabs" role="tablist" aria-label="Filter questions">
          {(["all", "open", "answered"] as const).map((key) => (
            <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
              {key === "all" ? "All questions" : key === "open" ? "Unanswered" : "Answered"}
            </button>
          ))}
        </div>
        {!asking && (
          <Button onClick={() => setAsking(true)}>
            <MessageCircleQuestion className="size-4" /> Ask a question
          </Button>
        )}
      </div>
      {asking && (
        <AskForm
          courseId={courseId}
          isStaff={!!list.data?.canModerate}
          onCancel={() => setAsking(false)}
          onCreated={(id) => {
            setAsking(false);
            setOpenId(id);
          }}
        />
      )}
      {list.isLoading && <p role="status" className="text-muted-foreground">Loading questions...</p>}
      {list.error && (
        <div role="alert" className="space-y-2">
          <p>{list.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {threads?.length === 0 && (
        <p className="py-4 text-muted-foreground">
          {filter === "all" ? "No questions yet. Be the first to ask something about this course." : "Nothing here yet."}
        </p>
      )}
      <ul className="space-y-3">
        {threads?.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setOpenId(t.id)}
              className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">{t.title}</h3>
                {t.resolved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="size-3.5" /> Answered
                  </span>
                ) : t.aiStatus === "ready" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                    <Bot className="size-3.5" /> AI answer
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.preview}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{t.author}</span>
                <RoleTag role={t.authorRole} />
                <span>· {ago(t.lastActivityAt)}</span>
                <span className="inline-flex items-center gap-1">
                  · <MessagesSquare className="size-3.5" /> {t.replyCount}
                </span>
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AskForm({
  courseId,
  isStaff,
  onCancel,
  onCreated,
}: {
  courseId: number;
  isStaff: boolean;
  onCancel: () => void;
  onCreated: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const { errors, check, clear } = useFieldErrors<"title" | "body">();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = trpc.discussions.create.useMutation({
    onSuccess: ({ id }) => {
      void utils.discussions.list.invalidate({ courseId });
      toast.success(isStaff ? "Posted to the course." : "Question posted. The AI is drafting an answer from your course notes.");
      onCreated(id);
    },
    onError: fail,
  });
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const ok = check({
          title: validateText(title, { label: "Question title", ...DISCUSSION_LIMITS.title }),
          body: validateText(body, { label: "Question details", ...DISCUSSION_LIMITS.body }),
        });
        if (ok) create.mutate({ courseId, title: title.trim(), body: body.trim() });
      }}
    >
      <div className="space-y-1.5">
        <Input
          aria-label="Question title"
          placeholder="What do you want to know?"
          value={title}
          maxLength={DISCUSSION_LIMITS.title.max}
          aria-invalid={Boolean(errors.title)}
          onChange={(e) => {
            setTitle(e.target.value);
            clear("title");
          }}
        />
        <FieldError message={errors.title} />
      </div>
      <div className="space-y-1.5">
        <Textarea
          aria-label="Question details"
          placeholder="Add details: which lecture or topic, and what you have tried."
          rows={4}
          value={body}
          maxLength={DISCUSSION_LIMITS.body.max}
          aria-invalid={Boolean(errors.body)}
          onChange={(e) => {
            setBody(e.target.value);
            clear("body");
          }}
        />
        <FieldError message={errors.body} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={create.isPending}>{create.isPending ? "Posting..." : "Post question"}</Button>
      </div>
    </form>
  );
}

export function DiscussionThread({ threadId, onBack }: { threadId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const query = trpc.discussions.get.useQuery(
    { threadId },
    { refetchInterval: (q) => (q.state.data?.ai.status === "pending" ? 3000 : false) }
  );
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const refresh = () => {
    void query.refetch();
    if (query.data) void utils.discussions.list.invalidate({ courseId: query.data.courseId });
  };
  const send = trpc.discussions.reply.useMutation({
    onSuccess: () => {
      setReply("");
      refresh();
    },
    onError: fail,
  });
  const endorse = trpc.discussions.endorse.useMutation({ onSuccess: refresh, onError: fail });
  const retry = trpc.discussions.retryAi.useMutation({ onSuccess: refresh, onError: fail });
  const removeThread = trpc.discussions.deleteThread.useMutation({
    onSuccess: () => {
      if (query.data) void utils.discussions.list.invalidate({ courseId: query.data.courseId });
      toast.success("Question deleted.");
      onBack();
    },
    onError: fail,
  });
  const removeReply = trpc.discussions.deleteReply.useMutation({ onSuccess: refresh, onError: fail });

  const back = (
    <Button variant="outline" size="sm" onClick={onBack}>
      <ArrowLeft className="size-4" /> All questions
    </Button>
  );
  if (query.isLoading) return <div className="space-y-3">{back}<p role="status" className="text-muted-foreground">Loading question...</p></div>;
  if (!query.data) return <div className="space-y-3">{back}<p role="alert">{query.error?.message ?? "This question was removed."}</p></div>;
  const t = query.data;

  return (
    <div className="space-y-4">
      {back}
      <article className="space-y-3 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-xl font-semibold">{t.title}</h3>
          {t.canDelete && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete question"
              disabled={removeThread.isPending}
              onClick={() => window.confirm("Delete this question and all its replies?") && removeThread.mutate({ threadId: t.id })}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t.author} <RoleTag role={t.authorRole} isLecturer={t.isLecturer} /> · {ago(t.createdAt)}
        </p>
        <p className="whitespace-pre-wrap">{t.body}</p>
      </article>

      {t.ai.status !== "none" && (
        <section
          className={`space-y-3 rounded-xl border p-5 ${t.ai.endorsed ? "border-emerald-400 bg-emerald-50/60" : "border-sky-200 bg-sky-50/50"}`}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Bot className="size-5 text-sky-700" /> AI suggested answer
              {t.ai.endorsed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  <BadgeCheck className="size-3.5" /> Endorsed by lecturer
                </span>
              )}
            </h4>
            {t.canModerate && t.ai.status === "ready" && (
              <Button
                size="sm"
                variant={t.ai.endorsed ? "outline" : "default"}
                disabled={endorse.isPending}
                onClick={() => endorse.mutate({ threadId: t.id, endorsed: !t.ai.endorsed })}
              >
                <BadgeCheck className="size-4" /> {t.ai.endorsed ? "Remove endorsement" : "Endorse answer"}
              </Button>
            )}
          </div>
          {t.ai.status === "pending" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading the course materials and drafting an answer...
            </p>
          )}
          {t.ai.status === "failed" && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">The AI couldn't draft an answer this time.</span>
              {t.canRetryAi && (
                <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate({ threadId: t.id })}>
                  <RefreshCw className="size-4" /> Try again
                </Button>
              )}
            </div>
          )}
          {t.ai.status === "ready" && t.ai.answer && (
            <>
              <div className="prose prose-sm max-w-none">
                <Streamdown>{t.ai.answer}</Streamdown>
              </div>
              {t.ai.sources.length > 0 && (
                <p className="text-xs text-muted-foreground">From: {t.ai.sources.join(", ")}</p>
              )}
              {!t.ai.endorsed && (
                <p className="text-xs text-muted-foreground">AI answers can be wrong. Your lecturer can endorse this answer once it's checked.</p>
              )}
            </>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h4 className="font-semibold">
          {t.replies.length} repl{t.replies.length === 1 ? "y" : "ies"}
        </h4>
        {t.replies.map((r) => (
          <div key={r.id} className={`space-y-2 rounded-xl border p-4 ${r.isEndorsed ? "border-emerald-400 bg-emerald-50/60" : "bg-card"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.author}</span>
                <RoleTag role={r.authorRole} isLecturer={r.isLecturer} /> · {ago(r.createdAt)}
                {r.isEndorsed && (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                    <BadgeCheck className="size-3.5" /> Endorsed
                  </span>
                )}
              </p>
              <div className="flex gap-1">
                {t.canModerate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={endorse.isPending}
                    onClick={() => endorse.mutate({ threadId: t.id, replyId: r.id, endorsed: !r.isEndorsed })}
                  >
                    <BadgeCheck className="size-4" /> {r.isEndorsed ? "Unendorse" : "Endorse"}
                  </Button>
                )}
                {r.canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete reply"
                    disabled={removeReply.isPending}
                    onClick={() => window.confirm("Delete this reply?") && removeReply.mutate({ replyId: r.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm">{r.body}</p>
          </div>
        ))}
        <form
          className="space-y-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const error = validateText(reply, { label: "Reply", ...DISCUSSION_LIMITS.reply });
            setReplyError(error);
            if (!error) send.mutate({ threadId: t.id, body: reply.trim() });
          }}
        >
          <Textarea
            aria-label="Your reply"
            placeholder="Write a reply..."
            rows={3}
            value={reply}
            maxLength={DISCUSSION_LIMITS.reply.max}
            aria-invalid={Boolean(replyError)}
            onChange={(e) => {
              setReply(e.target.value);
              setReplyError(null);
            }}
          />
          <FieldError message={replyError} />
          <div className="flex justify-end">
            <Button disabled={send.isPending}>{send.isPending ? "Sending..." : "Reply"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
