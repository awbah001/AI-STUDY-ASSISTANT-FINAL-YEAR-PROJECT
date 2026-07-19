import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { Megaphone, Plus, Trash2, BookMarked } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function LecturerAnnouncements() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const utils = trpc.useUtils();

  const { data: announcements, isLoading } = trpc.lecturer.announcements.list.useQuery(undefined, {
    enabled: isAllowed,
  });
  const { data: courses } = trpc.lecturer.courses.list.useQuery(undefined, { enabled: isAllowed });

  const createAnnouncement = trpc.lecturer.announcements.create.useMutation({
    onSuccess: () => {
      toast.success("Announcement posted");
      utils.lecturer.announcements.list.invalidate();
      setOpen(false);
      setCourseId(""); setTitle(""); setContent("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAnnouncement = trpc.lecturer.announcements.delete.useMutation({
    onSuccess: () => {
      toast.success("Announcement deleted");
      utils.lecturer.announcements.list.invalidate();
      utils.lecturer.dashboardStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAllowed) return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Announcements</h1>
            <p className="mt-1 text-sm text-slate-500">Post academic updates to your students.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Plus className="h-4 w-4" /> New announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl sm:max-w-md">
              <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Course</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger className="rounded-xl border-slate-200">
                      <SelectValue placeholder="Select a course..." />
                    </SelectTrigger>
                    <SelectContent>
                      {courses?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Exam postponed to next week" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Message</Label>
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Write your announcement..." className="rounded-xl" />
                </div>
                <Button
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={!courseId || !title.trim() || !content.trim() || createAnnouncement.isPending}
                  onClick={() => createAnnouncement.mutate({ courseId: Number(courseId), title, content })}
                >
                  {createAnnouncement.isPending ? "Posting..." : "Publish announcement"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : !announcements || announcements.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">No announcements yet</p>
            <p className="text-xs text-slate-400 mt-1">Click "New announcement" to post your first update.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-start justify-between gap-4 px-6 py-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 mt-0.5">
                      <Megaphone className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          <BookMarked className="h-3 w-3" /> {a.courseTitle}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                      <h3 className="font-semibold text-slate-900 mt-1.5">{a.title}</h3>
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.content}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm("Delete this announcement?")) {
                        deleteAnnouncement.mutate({ announcementId: a.id });
                      }
                    }}
                    disabled={deleteAnnouncement.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
