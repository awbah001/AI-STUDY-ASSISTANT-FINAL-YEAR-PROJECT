import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export default function AuthLayout(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  const { title, subtitle, children, className } = props;

  return (
    <div className="auth-emerald-animated-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl items-stretch px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm lg:grid-cols-2">
          {/* Left / Welcome */}
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 text-white lg:block">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute left-10 top-10 h-44 w-44 rounded-full bg-white/10" />
            <div className="absolute left-24 top-44 h-64 w-64 rounded-full bg-white/10" />

            <div className="relative flex h-full flex-col justify-between p-10">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full overflow-hidden bg-white/15">
                  <img src="/logo.png" alt="Cognify Logo" className="h-full w-full object-cover" />
                </div>
                <div className="text-lg font-semibold">Cognify</div>
              </div>

              <div className="max-w-md space-y-3">
                <div className="text-3xl font-semibold tracking-tight">WELCOME</div>
                <div className="text-white/90">
                  Your AI-powered study space for summaries, flashcards, quizzes, and
                  document chat.
                </div>
                <div className="text-sm text-white/80">
                  Sign in to continue, or create an account to start learning.
                </div>
              </div>

              <div className="text-xs text-white/70">
                Tip: Use a strong password and keep it private.
              </div>
            </div>
          </div>

          {/* Right / Form */}
          <div className={cn("flex items-center justify-center p-6 sm:p-12", className)}>
            <div className="w-full max-w-md">
              <div className="mb-7 space-y-2">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
                  <div className="h-4 w-4 rounded-full overflow-hidden ring-1 ring-emerald-500/20">
                    <img src="/logo.png" alt="Cognify Logo" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-xs font-semibold tracking-wide uppercase">Cognify</span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {title}
                </div>
                {subtitle ? (
                  <div className="text-sm text-muted-foreground">{subtitle}</div>
                ) : null}
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

