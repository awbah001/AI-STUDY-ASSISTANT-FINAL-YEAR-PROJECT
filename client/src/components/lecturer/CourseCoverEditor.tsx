import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { storagePut } from "@/lib/storage";
import { courseCoverSrc } from "@/components/student/CoursePage";

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Lets the lecturer set the picture students see at the top of the course page. */
export function CourseCoverEditor({
  courseId,
  coverImageUrl,
  children,
}: {
  courseId: number;
  coverImageUrl: string | null;
  children?: ReactNode;
}) {
  const utils = trpc.useUtils();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const update = trpc.lecturer.courses.update.useMutation({
    onSuccess: () => {
      void utils.lecturer.courses.invalidate();
      void utils.studentCourses.list.invalidate();
    },
  });

  const save = async (url: string | null, message: string) => {
    setBusy(true);
    try {
      await update.mutateAsync({ courseId, coverImageUrl: url });
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the cover.");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    const ext = COVER_TYPES[file.type];
    if (!ext) return toast.error("Choose a JPG, PNG or WebP image.");
    if (file.size > MAX_COVER_BYTES) return toast.error("The image is too large. Maximum size is 5 MB.");
    setBusy(true);
    try {
      const { url } = await storagePut(`courses/${courseId}/cover.${ext}`, await file.arrayBuffer(), file.type);
      await save(url, "Course cover updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-5">
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        title={coverImageUrl ? "Change cover" : "Upload cover"}
        className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200 sm:h-28 sm:w-28"
      >
        <img src={courseCoverSrc(coverImageUrl)} alt="Course cover" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        {children}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {coverImageUrl ? "Change cover" : "Upload cover"}
          </Button>
          {coverImageUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => void save(null, "Cover removed")}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          ) : null}
          <span className="text-xs text-slate-500">
            {coverImageUrl ? "Students see this picture on the course page." : "Students see the default picture until you add one."}
          </span>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label="Course cover image"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
    </div>
  );
}
