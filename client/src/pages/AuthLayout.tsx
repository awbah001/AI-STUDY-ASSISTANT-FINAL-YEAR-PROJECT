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
          <div className="relative hidden overflow-hidden lg:block"
            style={{
              background: "linear-gradient(135deg, rgba(186,230,253,0.7) 0%, rgba(224,242,254,0.6) 50%, rgba(186,230,253,0.75) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {/* Decorative blobs */}
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-sky-200/25 blur-3xl" />
            <div className="absolute left-10 top-10 h-44 w-44 rounded-full bg-white/20" />
            <div className="absolute left-24 top-44 h-64 w-64 rounded-full bg-sky-100/20" />

            <div className="relative flex h-full flex-col justify-between p-10">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full overflow-hidden bg-white/40 ring-2 ring-sky-300/40">
                  <img src="/logo.png" alt="Cognify Logo" className="h-full w-full object-cover" />
                </div>
                <div className="text-lg font-bold text-sky-900">Cognify</div>
              </div>

              <div className="max-w-md space-y-3">
                <div className="text-3xl font-bold tracking-tight text-sky-900">WELCOME</div>
                <div className="text-sky-800/90">
                  Your AI-powered study space for summaries, flashcards, quizzes, and
                  document chat.
                </div>
                <div className="text-sm text-sky-700/80">
                  Sign in to continue, or create an account to start learning.
                </div>
              </div>

              <div className="text-xs text-sky-700/70">
                Tip: Use a strong password and keep it private.
              </div>
            </div>
          </div>

          {/* Right / Form */}
          <div className={cn("flex items-center justify-center p-6 sm:p-12", className)}>
            <div className="w-full max-w-md">
              <div className="mb-7 space-y-2">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-sky-500/10 px-3 py-2 text-sky-700">
                  <div className="h-4 w-4 rounded-full overflow-hidden ring-1 ring-sky-500/20">
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

