import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { LoadingIndicator } from "./ui/spinner";

export function LoadingState({ label = "Loading content" }: { label?: string; rows?: number }) {
  return <LoadingIndicator label={label} className="query-state-loading" />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => unknown }) {
  return <div role="alert" className="query-state query-state-error">
    <AlertCircle className="size-6 shrink-0" aria-hidden="true" />
    <div><p className="font-semibold">We couldn’t load this content</p><p className="mt-1 text-sm">{message}</p>
      {onRetry && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void onRetry()}>Try again</Button>}
    </div>
  </div>;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="query-state query-state-empty">
    <Inbox className="size-7 shrink-0" aria-hidden="true" />
    <div><div className="text-sm leading-6">{children}</div>{action && <div className="mt-3">{action}</div>}</div>
  </div>;
}
