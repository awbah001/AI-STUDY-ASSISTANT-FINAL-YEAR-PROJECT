import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AppIcon } from "@/components/icons/AppIcon";

export function SaveResponseNote({
  content,
  documentId = 0,
}: {
  content: string;
  documentId?: number;
}) {
  const utils = trpc.useUtils();
  const save = trpc.personalNotes.saveResponse.useMutation({
    onSuccess: () => {
      toast.success("Saved to Personal notes");
      void utils.personalNotes.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={save.isPending}
      onClick={() => save.mutate({ content, documentId })}
    >
      {save.isPending ? <AppIcon name="LoaderCircle" className="mr-1.5 motion-safe:animate-spin text-emerald-700" size={16} mode="static" /> : save.isSuccess ? <AppIcon name="Check" className="mr-1.5 text-emerald-600" size={16} /> : <AppIcon name="BookMarked" className="mr-1.5" size={16} />}
      {save.isPending ? "Saving..." : save.isSuccess ? "Saved to notes" : "Save to notes"}
    </Button>
  );
}
