import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { BookOpen, Zap, ArrowRight } from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation(user?.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Navigation */}
      <nav className="border-b bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full overflow-hidden shrink-0">
              <img src="/logo.png" alt="Cognify Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-xl font-bold">Cognify</span>
          </div>
          <Button asChild>
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid gap-16 lg:grid-cols-[1.2fr_0.8fr] items-center">
          <div className="space-y-6 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
              Meet your study buddy
            </span>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Hi, I'm <span className="text-primary">Nova</span>, your learning bot.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              I’ll guide you through smarter study sessions, flashcards, quizzes,
              and document insights. Tap signup and let’s get your first learning plan started.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Button size="lg" onClick={() => setLocation("/signup")} className="gap-2">
                Create your free account <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={getLoginUrl()}>Already have an account?</a>
              </Button>
            </div>
          </div>

          <div className="relative isolate mx-auto w-full max-w-md">
            <div className="animate-bot-bob rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/80">
              <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-2xl bg-emerald-100/90 border border-emerald-200 shadow-2xl dark:bg-emerald-900/30 dark:border-emerald-500/30">
                <div className="absolute -top-4 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-300 shadow-lg dark:bg-emerald-500" />
                <div className="absolute inset-x-[38px] top-10 flex items-center justify-between">
                  <span className="h-5 w-5 rounded-full bg-slate-950/90 shadow-[0_0_12px_rgba(15,23,42,0.24)]" />
                  <span className="h-5 w-5 rounded-full bg-slate-950/90 shadow-[0_0_12px_rgba(15,23,42,0.24)] animate-bot-blink" />
                </div>
                <div className="absolute bottom-10 h-2 w-12 rounded-full bg-slate-950/70" />
              </div>
              <div className="mt-6 rounded-[1.75rem] bg-slate-950/5 p-5 text-center shadow-inner dark:bg-slate-700/10">
                <div className="mb-4 flex items-center justify-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.45)]" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Ready to help you learn faster.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white/90 p-4 text-left text-sm text-slate-600 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                    Upload a note and I'll build your study path.
                  </div>
                  <div className="rounded-2xl bg-white/90 p-4 text-left text-sm text-slate-600 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                    Click signup to start your first session.
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.15),transparent_55%)]" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Powerful Learning Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-lg border">
            <BookOpen className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Smart Summaries</h3>
            <p className="text-muted-foreground">
              Get concise summaries of your documents with key points highlighted by AI.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-8 rounded-lg border">
            <Brain className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">AI-Generated Quizzes</h3>
            <p className="text-muted-foreground">
              Test your knowledge with intelligent quizzes automatically created from your content.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-8 rounded-lg border">
            <Zap className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Interactive Chat</h3>
            <p className="text-muted-foreground">
              Ask questions about your documents and get instant, context-aware answers.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to Transform Your Learning?</h2>
          <p className="text-lg opacity-90">
            Join thousands of students using AI to study smarter, not harder.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="border-0 bg-white text-emerald-700 shadow-md hover:bg-emerald-50"
            asChild
          >
            <a href={getLoginUrl()}>Start Learning Today</a>
          </Button>
        </div>
      </section>
    </div>
  );
}
