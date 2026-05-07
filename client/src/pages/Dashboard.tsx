import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, ChevronRight, Clock, FileText, Layers, Sparkles, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: documents, isLoading: docsLoading } = trpc.documents.list.useQuery();
  const { data: progress, isLoading: progressLoading } = trpc.progress.stats.useQuery();

  const totalDocuments = documents?.length || 0;
  const totalQuizzes =
    progress?.reduce((sum, p) => sum + (p.quizzesAttempted || 0), 0) || 0;
  const totalFlashcards =
    progress?.reduce((sum, p) => sum + (p.flashcardsReviewed || 0), 0) || 0;

  const firstName = user?.name?.split(/\s+/)[0] ?? "there";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Welcome */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 via-white to-white p-6 shadow-sm shadow-emerald-900/5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-8">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
          <div className="pointer-events-none absolute -bottom-10 left-1/4 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl dark:bg-emerald-600/10" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Welcome back</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                Hi, {firstName}
              </h2>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                Pick up where you left off—review recent documents or open one to keep learning.
              </p>
            </div>
            <Button
              size="lg"
              className="mt-2 shrink-0 gap-2 rounded-2xl shadow-md shadow-emerald-600/20 sm:mt-0"
              onClick={() => setLocation("/upload")}
            >
              <Upload className="h-4 w-4" />
              Upload document
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
          <StatCard
            label="Documents"
            value={docsLoading ? null : totalDocuments}
            hint="In your library"
            icon={<BookOpen className="h-5 w-5 text-white" />}
            accent="from-emerald-500 to-emerald-600"
          />
          <StatCard
            label="Flashcards reviewed"
            value={progressLoading ? null : totalFlashcards}
            hint="Across all topics"
            icon={<Layers className="h-5 w-5 text-white" />}
            accent="from-blue-500 to-blue-600"
          />
          <StatCard
            label="Quiz attempts"
            value={progressLoading ? null : totalQuizzes}
            hint="Total completed"
            icon={<Brain className="h-5 w-5 text-white" />}
            accent="from-violet-500 to-violet-600"
          />
        </div>

        {/* Progress Quick View */}
        <Card className="overflow-hidden rounded-3xl border-emerald-100/70 shadow-md shadow-emerald-900/[0.04] dark:border-emerald-900/50">
          <CardHeader className="border-b border-emerald-50/80 bg-gradient-to-r from-emerald-50/50 to-transparent pb-4 dark:border-emerald-900/30 dark:from-emerald-950/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-600/25">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Your Progress</CardTitle>
                  <CardDescription className="mt-1">
                    Track your learning journey and see detailed analytics.
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 rounded-2xl"
                onClick={() => setLocation("/progress")}
              >
                View Details
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {progressLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Study Time</p>
                    <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                      {Math.floor((progress?.reduce((sum, p) => sum + (p.totalStudyTimeMinutes || 0), 0) || 0) / 60)}h {(progress?.reduce((sum, p) => sum + (p.totalStudyTimeMinutes || 0), 0) || 0) % 60}m
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Avg Score</p>
                    <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                      {progress && progress.length > 0
                        ? (progress.reduce((sum, p) => sum + (p.averageQuizScore || 0), 0) / progress.length).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Current Streak</p>
                    <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                      {progress?.reduce((max, p) => Math.max(max, p.currentStreak || 0), 0) || 0} days
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="overflow-hidden rounded-3xl border-emerald-100/70 shadow-md shadow-emerald-900/[0.04] dark:border-emerald-900/50">
          <CardHeader className="border-b border-emerald-50/80 bg-gradient-to-r from-emerald-50/50 to-transparent pb-4 dark:border-emerald-900/30 dark:from-emerald-950/30">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-600/25">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Recent activity</CardTitle>
                <CardDescription className="mt-1">
                  Open a document to view the PDF and chat with AI on the document page.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {docsLoading ? (
              <div className="space-y-2 p-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
                ))}
              </div>
            ) : documents && documents.length > 0 ? (
              <ul className="divide-y divide-emerald-50/90 dark:divide-emerald-950/50">
                {documents.slice(0, 5).map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => setLocation(`/document/${doc.id}`)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400 ring-2 ring-emerald-100 ring-offset-2 ring-offset-background dark:bg-emerald-500 dark:ring-emerald-900" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">{doc.title}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            Added{" "}
                            {new Date(doc.createdAt).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        Open
                        <ChevronRight className="h-4 w-4 opacity-80" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950">
                  <Sparkles className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">No documents yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Upload a PDF to generate summaries, flashcards, quizzes, and chat with your content.
                  </p>
                </div>
                <Button size="lg" className="gap-2 rounded-2xl" onClick={() => setLocation("/upload")}>
                  <Upload className="h-4 w-4" />
                  Upload your first document
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StatCard(props: {
  label: string;
  value: number | null;
  hint: string;
  icon: React.ReactNode;
  accent: string;
}) {
  const shadowColor = props.accent.includes("emerald") 
    ? "shadow-emerald-600/20" 
    : props.accent.includes("blue") 
    ? "shadow-blue-600/20" 
    : props.accent.includes("violet") 
    ? "shadow-violet-600/20" 
    : "shadow-slate-600/20";

  return (
    <Card className={`group relative overflow-hidden rounded-3xl border-slate-100 shadow-md shadow-slate-900/[0.05] transition-shadow hover:shadow-lg hover:shadow-slate-900/[0.08] dark:border-slate-800`}>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${props.accent} opacity-90`}
      />
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500/90 dark:text-slate-400/90">
              {props.label}
            </p>
            {props.value === null ? (
              <Skeleton className="h-10 w-20 rounded-2xl" />
            ) : (
              <p className="text-4xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
                {props.value}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{props.hint}</p>
          </div>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${props.accent} shadow-lg ${shadowColor}`}
          >
            {props.icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
