import { AdminHero } from "@/components/admin/AdminHero";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  FileText,
  History,
  Mail,
  Megaphone,
  MoreVertical,
  PenLine,
  Save,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/lib/formValidation";
import { validateText } from "@shared/validation";

const DRAFT_KEY = "cognify.admin.announcement.draft";
const MESSAGE_MAX = 1000;

type Audience = "all" | "inactive" | "course" | "lecturers";

export default function AdminCommunications() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [audience, setAudience] = useState<Audience>("all");
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const { errors, check, clear } = useFieldErrors<"courseId" | "title" | "body">();

  const { data: academic } = trpc.admin.getAcademicPerformance.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: stats, isLoading: statsLoading } = trpc.admin.getCommunicationStats.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const send = trpc.admin.sendAnnouncement.useMutation({
    onSuccess: ({ recipients }) => {
      toast.success(`Announcement sent to ${recipients} recipient${recipients === 1 ? "" : "s"}.`);
      setTitle("");
      setBody("");
      localStorage.removeItem(DRAFT_KEY);
      utils.admin.getCommunicationStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        audience?: Audience;
        courseId?: string;
        title?: string;
        body?: string;
      };
      if (draft.audience) setAudience(draft.audience);
      if (draft.courseId) setCourseId(draft.courseId);
      if (draft.title) setTitle(draft.title);
      if (draft.body) setBody(draft.body);
    } catch {
      /* ignore corrupt draft */
    }
  }, []);


  if (!user || user.role !== "admin") return null;

  const history = stats?.recent ?? [];
  const visibleHistory = historyExpanded ? history : history.slice(0, 4);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = check({
      courseId: audience === "course" && !courseId ? "Choose the course that should receive this announcement." : null,
      title: validateText(title, { label: "Title", min: 2, max: 160 }),
      body: validateText(body, { label: "Message", min: 5, max: MESSAGE_MAX }),
    });
    if (!ok) return;
    send.mutate({
      audience,
      title: title.trim(),
      body: body.trim(),
      courseId: audience === "course" ? Number(courseId) : undefined,
    });
  };

  const saveDraft = () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ audience, courseId, title, body })
    );
    toast.success("Draft saved on this device.");
  };

  return (
    <DashboardLayout>
      <main className="admin-content admin-communications mx-auto space-y-5">
        {/* Hero */}
        <AdminHero kind="communications" />

        {/* Stats */}
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Messages delivered"
            value={statsLoading ? "—" : stats?.sent ?? 0}
            hint="Delivered to user inboxes"
            icon={<Mail className="h-4 w-4" />}
            iconClass="bg-emerald-50 text-emerald-700"


          />
          <StatCard
            label="Messages read"
            value={statsLoading ? "—" : stats?.read ?? 0}
            hint={`${stats?.readRate ?? 0}% open rate`}
            icon={<BookOpen className="h-4 w-4" />}
            iconClass="bg-sky-50 text-sky-700"


          />
          <StatCard
            label="Read rate"
            value={statsLoading ? "—" : `${stats?.readRate ?? 0}%`}
            hint="of delivered messages"
            icon={<Users className="h-4 w-4" />}
            iconClass="bg-violet-50 text-violet-700"


          />
        </section>

        {/* Form + History */}
        <section className="grid gap-5 admin-communications-columns lg:grid-cols-[1.34fr_1fr]">
          <form
            onSubmit={submit}
            className="space-y-5 rounded-[1.25rem] border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Send className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">New announcement</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Send a message to selected users and monitor delivery.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Audience</label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as Audience)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-8 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                >
                  <option value="all">All students</option>
                  <option value="lecturers">All lecturers</option>
                  <option value="inactive">Inactive students (14+ days)</option>
                  <option value="course">Specific course</option>
                </select>
              </div>
            </div>

            {audience === "course" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Course</label>
                <div className="relative">
                  <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={courseId}
                    aria-invalid={Boolean(errors.courseId)}
                    onChange={(e) => { setCourseId(e.target.value); clear("courseId"); }}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 aria-invalid:border-destructive bg-white pl-10 pr-8 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  >
                    <option value="">Select a course</option>
                    {academic?.courses.map((c) => (
                      <option key={c.courseId} value={c.courseId}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <FieldError message={errors.courseId} />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  maxLength={160}
                  value={title}
                  aria-invalid={Boolean(errors.title)}
                  onChange={(e) => { setTitle(e.target.value); clear("title"); }}
                  placeholder="Enter announcement title..."
                  className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500"
                />
              </div>
              <FieldError message={errors.title} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Message</label>
              <div className="relative">
                <PenLine className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <textarea
                  maxLength={MESSAGE_MAX}
                  value={body}
                  aria-invalid={Boolean(errors.body)}
                  onChange={(e) => { setBody(e.target.value); clear("body"); }}
                  placeholder="Type your message here..."
                  className="min-h-[80px] w-full resize-y rounded-xl border border-slate-200 aria-invalid:border-destructive bg-white py-3 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
                <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] font-medium text-slate-400">
                  {body.length}/{MESSAGE_MAX}
                </span>
              </div>
              <FieldError message={errors.body} />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="submit"
                disabled={send.isPending}
                variant="accent"
                className="h-10 gap-2 rounded-full px-4 text-sm font-semibold"
              >
                <Send className="h-4 w-4" />
                {send.isPending ? "Sending…" : "Send announcement"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={saveDraft}
                className="h-10 gap-2 rounded-full border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <Save className="h-4 w-4" />
                Save draft
              </Button>
            </div>
          </form>

          <section className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <History className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900">Announcement history</h2>
                  <p className="mt-0.5 text-sm text-slate-500">View and track all sent messages.</p>
                </div>
              </div>
              {history.length > 4 ? (
                <button
                  type="button"
                  onClick={() => setHistoryExpanded((v) => !v)}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  {historyExpanded ? "Show less" : "View all"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="admin-announcement-list">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                ))
              ) : visibleHistory.length ? (
                visibleHistory.map((item) => {
                  const tone = historyTone(item.title, item.audience);
                  const Icon = tone.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 sm:px-6"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.iconClass}`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-semibold text-slate-900">{item.title}</p>
                          <button
                            type="button"
                            aria-label="More"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            onClick={() => {
                              void navigator.clipboard?.writeText(
                                `${item.title}\n${item.body}`
                              );
                              toast.success("Announcement copied.");
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {audienceLabel(item.audience)}
                          <span className="mx-1.5 text-slate-300">·</span>
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                        <div className="mt-2">
                          {item.isRead ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Read
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600">
                              Unread
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
                    <Megaphone className="h-7 w-7" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">No announcements yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Send your first message to see delivery history here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  hint,
  hintTone,
  icon,
  iconClass,


}: {
  label: string;
  value: string | number;
  hint: string;
  hintTone?: "up";
  icon: ReactNode;
  iconClass: string;


}) {
  return (
    <div className="admin-stat-card rounded-[1.1rem] border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p
        className={`mt-0.5 text-xs font-medium ${
          hintTone === "up" ? "text-emerald-600" : "text-slate-500"
        }`}
      >
        {hintTone === "up" ? `↑ ${hint}` : hint}
      </p>
    </div>
  );
}


function audienceLabel(audience: string | null | undefined): string {
  switch (audience) {
    case "lecturers":
      return "All lecturers";
    case "inactive":
      return "Inactive students";
    case "course":
      return "Course students";
    case "all":
    default:
      return "All students";
  }
}

function historyTone(title: string, audience: string | null | undefined) {
  const t = title.toLowerCase();
  if (t.includes("maintenance") || t.includes("system")) {
    return { icon: Settings, iconClass: "bg-amber-50 text-amber-600" };
  }
  if (t.includes("exam") || t.includes("schedule")) {
    return { icon: Calendar, iconClass: "bg-rose-50 text-rose-600" };
  }
  if (t.includes("course") || audience === "lecturers") {
    return { icon: Users, iconClass: "bg-sky-50 text-sky-700" };
  }
  return { icon: Megaphone, iconClass: "bg-violet-50 text-violet-700" };
}
