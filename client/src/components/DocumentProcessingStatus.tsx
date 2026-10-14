import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "./ui/button";

export function DocumentProcessingStatus({ doc }: { doc: { id: number; userId: number; processingStatus: string; processingError?: string | null } }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const retry = trpc.documents.retryProcessing.useMutation({ onSuccess: () => {
    void utils.documents.get.invalidate({ id: doc.id });
    void utils.documents.list.invalidate();
  } });
  const labels: Record<string, string> = { pending: "Queued for processing", processing: "Processing document…", ready: "Ready for AI study", failed: "Processing failed" };
  return <div role="status" className={`space-y-2 rounded-xl border px-3 py-2 text-sm ${doc.processingStatus === "failed" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
    <p>{labels[doc.processingStatus] ?? "Queued for processing"}</p>
    {doc.processingStatus === "failed" && <>
      <p>{doc.processingError || "The file could not be processed."}</p>
    </>}
    {doc.processingStatus !== "ready" && (user?.id === doc.userId || user?.role === "admin") && <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate({ id: doc.id })}>{retry.isPending ? "Retrying…" : "Retry processing"}</Button>}
    {retry.error && <p role="alert">{retry.error.message}</p>}
  </div>;
}
