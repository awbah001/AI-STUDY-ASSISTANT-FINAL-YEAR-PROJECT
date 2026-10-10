import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FieldError({ message, id, className }: { message?: string | null; id?: string; className?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn("mt-1 flex items-start gap-1.5 text-xs font-medium text-destructive", className)}>
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
