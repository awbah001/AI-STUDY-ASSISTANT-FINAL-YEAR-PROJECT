import { ReactNode } from "react";
import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuthLayout(props: { title: string; subtitle?: string; children: ReactNode; className?: string; noScroll?: boolean }) {
  const { title, subtitle, children, className } = props;
  return (
    <main className="auth-card-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6 sm:px-6">
      <div className="auth-card-orb auth-card-orb-one" /><div className="auth-card-orb auth-card-orb-two" />
      <section className="relative z-10 grid w-full max-w-[1040px] overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(3,60,53,0.2)] lg:grid-cols-[.96fr_1fr]">
        <aside className="auth-panel relative hidden min-h-[620px] overflow-hidden p-11 text-white lg:flex lg:flex-col">
          <div className="auth-hero-orb auth-hero-orb-one" /><div className="auth-hero-orb auth-hero-orb-two" />
          <div className="relative z-10 flex items-center gap-3"><img src="/logo.png" alt="Cognify" className="h-12 w-12 rounded-2xl object-cover" /><div><p className="text-2xl font-bold tracking-tight">Cognify</p><p className="text-sm text-emerald-100/90">AI Learning Assistant</p></div></div>
          <div className="relative z-10 my-auto">
            <div className="auth-mascot mx-auto mb-6" aria-hidden="true">
              <img src="/cognify-auth-bot.png?v=2" alt="" />
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">Learn Smarter,<br /><span className="text-emerald-300">Achieve More.</span></h1>
            <p className="mt-4 max-w-xs text-sm leading-6 text-emerald-50/90">Your AI-powered companion for personalized learning, deeper understanding, and academic success.</p>
          </div>
          <p className="relative z-10 text-xs text-emerald-100/80">Learn. Practice. Progress.</p>
        </aside>
        <div className={cn(
          "relative flex min-h-[620px] items-center justify-center bg-white p-6 sm:p-8",
          props.noScroll ? "overflow-hidden" : "overflow-y-auto",
          className
        )}>
          <div className="w-full max-w-[390px]">
            <div className="mb-4 text-center lg:hidden">
              <img src="/logo.png" alt="Cognify" className="mx-auto h-11 w-11 rounded-2xl" />
              <p className="mt-2 text-xl font-bold text-[#063d35]">Cognify</p>
            </div>
            <div className="mb-5">
              <div className="mb-3 hidden h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 lg:flex">
                <BrainCircuit className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#063d35] sm:text-2xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
