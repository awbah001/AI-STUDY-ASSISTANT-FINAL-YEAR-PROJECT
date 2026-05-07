import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { BookOpen, Sparkles, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

type FlashcardLibraryItem = {
  id: number;
  title: string;
  createdAt: Date;
  totalCards: number;
  reviewedCards: number;
  progressPercent: number;
};

export default function FlashcardsLibrary() {
  const [, setLocation] = useLocation();
  const { data: documents, isLoading: documentsLoading } = trpc.documents.list.useQuery();
  const { data: progress, isLoading: progressLoading } = trpc.progress.stats.useQuery();

  const progressByDocument = new Map((progress ?? []).map((item) => [item.documentId, item]));

  const flashcardSets: FlashcardLibraryItem[] = (documents ?? [])
    .map((doc) => {
      const stats = progressByDocument.get(doc.id);
      const totalCards = stats?.flashcardsCreated ?? 0;
      const reviewedCards = stats?.flashcardsReviewed ?? 0;
      const progressPercent =
        totalCards > 0 ? Math.min(100, Math.round((reviewedCards / totalCards) * 100)) : 0;

      return {
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        totalCards,
        reviewedCards,
        progressPercent,
      };
    })
    .sort((a, b) => {
      if (b.totalCards !== a.totalCards) return b.totalCards - a.totalCards;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const isLoading = documentsLoading || progressLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Flashcards</h1>
          <p className="text-sm text-slate-500">
            Review your AI study sets and jump back into any document with one click.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-[260px] rounded-[28px]" />
            ))}
          </div>
        ) : flashcardSets.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {flashcardSets.map((set) => {
              const createdLabel = `Created ${formatDistanceToNow(new Date(set.createdAt), {
                addSuffix: true,
              })}`;

              return (
                <Card
                  key={set.id}
                  className="group rounded-[28px] border border-slate-200 bg-white shadow-[0_2px_14px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_28px_rgba(79,70,229,0.14)]"
                >
                  <CardContent className="flex h-full flex-col gap-5 p-5">
                    <div className="flex items-start gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="line-clamp-2 text-[1.05rem] font-semibold leading-6 text-slate-900">
                          {set.title}
                        </h2>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          {createdLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-2xl border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                      >
                        {set.totalCards} Cards
                      </Badge>
                      {set.progressPercent > 0 ? (
                        <Badge className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 shadow-none hover:bg-emerald-50">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {set.progressPercent}%
                        </Badge>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Progress</span>
                        <span>
                          {set.reviewedCards}/{set.totalCards} reviewed
                        </span>
                      </div>
                      <Progress
                        value={set.progressPercent}
                        className="h-2.5 rounded-full bg-slate-100 [&_[data-slot=progress-indicator]]:bg-emerald-500"
                      />
                    </div>

                    <Button
                      className="mt-auto rounded-2xl bg-gradient-to-r from-emerald-100 via-emerald-50 to-blue-100 text-emerald-900 shadow-none transition-all hover:from-emerald-200 hover:via-emerald-100 hover:to-blue-200"
                      onClick={() => setLocation(`/document/${set.id}?tab=flashcards`)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Study Now
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="rounded-[28px] border-dashed border-emerald-200 bg-emerald-50/40">
            <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-emerald-100 text-emerald-700">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-900">No flashcard sets yet</h2>
                <p className="text-sm text-slate-500">
                  Generate flashcards from any document and they’ll appear here in this study library.
                </p>
              </div>
              <Button className="rounded-2xl" onClick={() => setLocation("/documents")}>
                Open documents
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
