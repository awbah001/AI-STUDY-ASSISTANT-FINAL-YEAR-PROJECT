import { Check, Circle } from "lucide-react";
import { LIMITS } from "@shared/validation";
import { cn } from "@/lib/utils";

const RULES = [
  { label: `At least ${LIMITS.password.min} characters`, test: (v: string) => v.length >= LIMITS.password.min },
  { label: "A letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "A number", test: (v: string) => /\d/.test(v) },
];

export function PasswordRules({ value, className }: { value: string; className?: string }) {
  return (
    <ul className={cn("mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs", className)} aria-label="Password requirements">
      {RULES.map(rule => {
        const ok = rule.test(value);
        return (
          <li key={rule.label} className={cn("flex items-center gap-1.5", ok ? "text-emerald-700" : "text-slate-500")}>
            {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
