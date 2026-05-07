import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  ExternalLink,
  FileText,
  Heart,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DocumentChatBox } from "@/components/DocumentChatBox";
import { Streamdown } from "streamdown";
import { FlashcardComponent } from "@/components/FlashcardComponent";
import { QuizComponent } from "@/components/QuizComponent";
import { cn } from "@/lib/utils";

const tabTriggerClass =
  "gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm font-medium text-muted-foreground shadow-none transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-700 data-[state=active]:shadow-none dark:data-[state=active]:border-emerald-500 dark:data-[state=active]:text-emerald-400 sm:px-5";

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const docId = parseInt(id || "0");
  const initialTab =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("tab") || "content"
      : "content";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [summaryTopic, setSummaryTopic] = useState("");
  const utils = trpc.useUtils();

  useEffect(() => {
    const nextTab =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("tab") || "content"
        : "content";
    setActiveTab(nextTab);
    setSummaryTopic(""); // Reset topic when switching docs

    // Clear stale queries to prevent state persistence from previous documents
    if (docId) {
      void utils.summary.get.reset({ documentId: docId });
      void utils.flashcards.list.reset({ documentId: docId });
      void utils.quizzes.list.reset({ documentId: docId });
      void utils.progress.get.reset({ documentId: docId });
      void utils.chat.history.reset({ documentId: docId });
    }
  }, [id, docId, utils]);

  const { data: doc, isLoading: docLoading } = trpc.documents.get.useQuery({ id: docId });
  const { data: summary, isLoading: summaryLoading } = trpc.summary.get.useQuery(
    { documentId: docId },
    { enabled: !!docId }
  );
  const { data: flashcards, isLoading: flashcardsLoading } = trpc.flashcards.list.useQuery(
    { documentId: docId },
    { enabled: !!docId }
  );
  const { data: quizzes, isLoading: quizzesLoading } = trpc.quizzes.list.useQuery(
    { documentId: docId },
    { enabled: !!docId }
  );
  const { data: progress } = trpc.progress.get.useQuery({ documentId: docId }, { enabled: !!docId });

  const generateSummaryMutation = trpc.summary.generate.useMutation({
    onSuccess: () => {
      toast.success("Summary generated!");
      void utils.summary.get.invalidate({ documentId: docId });
      setActiveTab("ai");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate summary");
    },
  });

  const generateFlashcardsMutation = trpc.flashcards.generate.useMutation({
    onSuccess: () => {
      toast.success("Flashcards generated!");
      void utils.flashcards.list.invalidate({ documentId: docId });
      void utils.progress.get.invalidate({ documentId: docId });
      setActiveTab("flashcards");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate flashcards");
    },
  });

  const generateQuizMutation = trpc.quizzes.generate.useMutation({
    onSuccess: () => {
      toast.success("Quiz generated!");
      void utils.quizzes.list.invalidate({ documentId: docId });
      void utils.progress.get.invalidate({ documentId: docId });
      setActiveTab("quizzes");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate quiz");
    },
  });

  const toggleFavoriteMutation = trpc.documents.toggleFavorite.useMutation({
    onSuccess: () => {
      toast.success("Favorite updated");
      void utils.documents.get.invalidate({ id: docId });
    },
  });

  const handleGenerateSummary = () => {
    const topic = summaryTopic.trim();
    generateSummaryMutation.mutate({
      documentId: docId,
      topic: topic.length > 0 ? topic : undefined,
    });
  };

  if (docLoading) {
    return (
      <DashboardLayout>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </DashboardLayout>
    );
  }

  if (!doc) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Document not found</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div key={docId} className="mx-auto max-w-6xl space-y-6">
        {/* Back + title row */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setLocation("/documents")}
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                {doc.title}
              </h1>
              {doc.description && (
                <p className="mt-2 max-w-3xl text-muted-foreground">{doc.description}</p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Uploaded {new Date(doc.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              size="lg"
              variant="outline"
              onClick={() => toggleFavoriteMutation.mutate({ id: doc.id })}
              className={cn(
                "shrink-0 rounded-2xl border-slate-200 dark:border-slate-800",
                doc.isFavorite ? "text-red-500 border-red-200" : ""
              )}
            >
              <Heart className="h-5 w-5" fill={doc.isFavorite ? "currentColor" : "none"} />
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Quizzes attempted", value: progress?.quizzesAttempted ?? 0 },
            {
              label: "Avg score",
              value: progress?.averageQuizScore
                ? `${parseFloat(progress.averageQuizScore.toString()).toFixed(1)}%`
                : "0%",
            },
            { label: "Flashcards", value: progress?.flashcardsCreated ?? 0 },
            { label: "Reviewed", value: progress?.flashcardsReviewed ?? 0 },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="rounded-2xl border-slate-100/80 bg-white shadow-sm dark:border-slate-800/40 dark:bg-card"
            >
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs — Content | Chat | AI Actions | Flashcards | Quizzes */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto border-b border-slate-200/80 dark:border-slate-700/80">
            <TabsList className="inline-flex h-auto min-w-full justify-start rounded-none border-0 bg-transparent p-0">
              <TabsTrigger value="content" className={tabTriggerClass}>
                <FileText className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="chat" className={tabTriggerClass}>
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="ai" className={tabTriggerClass}>
                <Sparkles className="h-4 w-4" />
                AI Actions
              </TabsTrigger>
              <TabsTrigger value="flashcards" className={tabTriggerClass}>
                <Brain className="h-4 w-4" />
                Flashcards
              </TabsTrigger>
              <TabsTrigger value="quizzes" className={tabTriggerClass}>
                <BarChart3 className="h-4 w-4" />
                Quizzes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content — PDF viewer only */}
          <TabsContent value="content" className="mt-6 outline-none">
            <Card className="overflow-hidden rounded-2xl border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-4 dark:border-slate-800">
                <CardTitle className="text-base font-semibold">Document Viewer</CardTitle>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Open in new tab
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                  <iframe
                    title={`Document — ${doc.title}`}
                    src={doc.fileUrl}
                    className="h-[min(78vh,820px)] w-full bg-white dark:bg-slate-950"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat — assistant only */}
          <TabsContent value="chat" className="mt-6 outline-none">
            <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-md dark:border-slate-800">
              <CardHeader className="border-b border-slate-50 py-4 dark:border-slate-800/60">
                <CardTitle className="text-lg">Chat with your document</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ask questions while you read—the AI uses your document as context.
                </p>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <DocumentChatBox
                  documentId={docId}
                  height="min(78vh, 820px)"
                  className="border-0 shadow-none"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Actions — summary + generators */}
          <TabsContent value="ai" className="mt-6 space-y-6 outline-none">
            {summaryLoading ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : summary ? (
              <Card className="rounded-2xl border-emerald-100/80 shadow-sm dark:border-emerald-900/50">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>AI summary</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Generated from your document with the local AI (RAG + LM Studio).
                    </p>
                  </div>
                  <div className="w-full sm:w-auto sm:min-w-[360px] space-y-2">
                    <Input
                      value={summaryTopic}
                      onChange={(e) => setSummaryTopic(e.target.value)}
                      maxLength={120}
                      placeholder="Optional: focus summary on a topic (e.g., neural networks)"
                      className="rounded-2xl"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 rounded-2xl w-full sm:w-auto"
                      disabled={generateSummaryMutation.isPending}
                      onClick={handleGenerateSummary}
                    >
                      {generateSummaryMutation.isPending
                        ? "Regenerating…"
                        : summaryTopic.trim()
                          ? "Regenerate for topic"
                          : "Regenerate with AI"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Streamdown>{summary.summary}</Streamdown>
                  {summary.keyPoints && summary.keyPoints.length > 0 && (
                    <div>
                      <h3 className="mb-2 font-semibold">Key points</h3>
                      <ul className="space-y-2">
                        {summary.keyPoints.map((point, idx) => (
                          <li key={idx} className="flex gap-2 text-sm">
                            <span className="text-emerald-600 dark:text-emerald-400">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl border-dashed border-slate-200 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-900/20">
                <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                  <Sparkles className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">No summary yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Enter an optional topic and generate a focused summary.
                    </p>
                  </div>
                  <Input
                    value={summaryTopic}
                    onChange={(e) => setSummaryTopic(e.target.value)}
                    maxLength={120}
                    placeholder="Optional topic from this document"
                    className="max-w-xl rounded-2xl"
                  />
                  <Button
                    onClick={handleGenerateSummary}
                    disabled={generateSummaryMutation.isPending}
                  >
                    {generateSummaryMutation.isPending
                      ? "Generating…"
                      : summaryTopic.trim()
                        ? "Generate summary for topic"
                        : "Generate summary with AI"}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border-slate-200/90 dark:border-slate-700/80">
              <CardHeader>
                <CardTitle className="text-base">More AI tools</CardTitle>
                <p className="text-sm text-muted-foreground">
                  All generation uses your indexed document text and the local LLM. You can also type{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/summary</code>,{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/flashcards</code>, or{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/quiz</code> in the Chat tab.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setActiveTab("flashcards")}
                >
                  Open flashcards tab
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setActiveTab("quizzes")}
                >
                  Open quizzes tab
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-2xl"
                  onClick={() => generateFlashcardsMutation.mutate({ documentId: docId, count: 10 })}
                  disabled={generateFlashcardsMutation.isPending}
                >
                  {generateFlashcardsMutation.isPending ? "Generating…" : "Generate flashcards"}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-2xl"
                  onClick={() => generateQuizMutation.mutate({ documentId: docId, questionCount: 5 })}
                  disabled={generateQuizMutation.isPending}
                >
                  {generateQuizMutation.isPending ? "Generating…" : "Generate quiz"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flashcards" className="mt-6 space-y-4 outline-none">
            {flashcardsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : flashcards && flashcards.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/20 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">AI flashcards</span> — add another batch
                    anytime.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0 rounded-2xl"
                    disabled={generateFlashcardsMutation.isPending}
                    onClick={() => generateFlashcardsMutation.mutate({ documentId: docId, count: 10 })}
                  >
                    {generateFlashcardsMutation.isPending ? "Generating…" : "Generate more with AI"}
                  </Button>
                </div>
                {flashcards.map((card) => (
                  <FlashcardComponent key={card.id} card={card} documentId={docId} />
                ))}
              </div>
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-8 text-center">
                  <p className="mb-4 text-muted-foreground">No AI flashcards yet</p>
                  <Button
                    onClick={() => generateFlashcardsMutation.mutate({ documentId: docId, count: 10 })}
                    disabled={generateFlashcardsMutation.isPending}
                  >
                    {generateFlashcardsMutation.isPending ? "Generating…" : "Generate flashcards with AI"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="quizzes" className="mt-6 space-y-4 outline-none">
            {quizzesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            ) : quizzes && quizzes.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/20 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">AI quizzes</span> — each run creates a new quiz
                    from the document.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0 rounded-2xl"
                    disabled={generateQuizMutation.isPending}
                    onClick={() => generateQuizMutation.mutate({ documentId: docId, questionCount: 5 })}
                  >
                    {generateQuizMutation.isPending ? "Generating…" : "Generate another quiz with AI"}
                  </Button>
                </div>
                {quizzes.map((quiz) => (
                  <QuizComponent key={quiz.id} quiz={quiz} />
                ))}
              </div>
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-8 text-center">
                  <p className="mb-4 text-muted-foreground">No AI quizzes yet</p>
                  <Button
                    onClick={() => generateQuizMutation.mutate({ documentId: docId, questionCount: 5 })}
                    disabled={generateQuizMutation.isPending}
                  >
                    {generateQuizMutation.isPending ? "Generating…" : "Generate quiz with AI"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
