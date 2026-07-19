import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { storagePut } from "@/lib/storage";
import { useRoute, useLocation } from "wouter";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, Users, FileText, Megaphone, ClipboardList,
  Brain, Layers, Trash2, ArrowLeft, HelpCircle,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2,
} from "lucide-react";

export default function LecturerCourseDetail() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [, params] = useRoute("/lecturer/courses/:id");
  const [, setLocation] = useLocation();
  const courseId = Number(params?.id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [enrollEmail, setEnrollEmail] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState<"notes" | "pdf" | "slides" | "assignment" | "other">("pdf");
  const [uploading, setUploading] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDue, setAssignDue] = useState("");

  const [quizDocId, setQuizDocId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [previewQuizId, setPreviewQuizId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: course } = trpc.lecturer.courses.get.useQuery(
    { courseId },
    { enabled: isAllowed && !Number.isNaN(courseId) }
  );
  const { data: materials } = trpc.lecturer.materials.list.useQuery(
    { courseId },
    { enabled: isAllowed && !Number.isNaN(courseId) }
  );
  const { data: students } = trpc.lecturer.students.listByCourse.useQuery(
    { courseId },
    { enabled: isAllowed && !Number.isNaN(courseId) }
  );
  const { data: assignments } = trpc.lecturer.assignments.list.useQuery(
    { courseId },
    { enabled: isAllowed && !Number.isNaN(courseId) }
  );
  const { data: announcements } = trpc.lecturer.announcements.listByCourse.useQuery(
    { courseId },
    { enabled: isAllowed && !Number.isNaN(courseId) }
  );

  const extractMutation = trpc.documents.extractDocumentText.useMutation();
  const uploadMaterial = trpc.lecturer.materials.upload.useMutation({
    onSuccess: () => {
      toast.success("Material uploaded");
      utils.lecturer.materials.list.invalidate({ courseId });
      utils.lecturer.dashboardStats.invalidate();
      setMaterialTitle("");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMaterial = trpc.lecturer.materials.delete.useMutation({
    onSuccess: () => utils.lecturer.materials.list.invalidate({ courseId }),
  });
  const enrollStudent = trpc.lecturer.students.enroll.useMutation({
    onSuccess: (r) => {
      toast[r.success ? "success" : "error"](r.message);
      if (r.success) {
        utils.lecturer.students.listByCourse.invalidate({ courseId });
        setEnrollEmail("");
      }
    },
  });
  const removeStudent = trpc.lecturer.students.remove.useMutation({
    onSuccess: () => utils.lecturer.students.listByCourse.invalidate({ courseId }),
  });
  const createAnnouncement = trpc.lecturer.announcements.create.useMutation({
    onSuccess: () => {
      toast.success("Announcement posted");
      utils.lecturer.announcements.listByCourse.invalidate({ courseId });
      setAnnTitle("");
      setAnnContent("");
    },
  });
  const createAssignment = trpc.lecturer.assignments.create.useMutation({
    onSuccess: () => {
      toast.success("Assignment created");
      utils.lecturer.assignments.list.invalidate({ courseId });
      setAssignTitle("");
      setAssignDesc("");
      setAssignDue("");
    },
  });
  const { data: quizList, isLoading: quizzesLoading } = trpc.lecturer.quizzes.list.useQuery(
    { courseId },
    { enabled: isAllowed && !Number.isNaN(courseId) }
  );

  const genQuiz = trpc.lecturer.quizzes.generate.useMutation({
    onSuccess: (quiz) => {
      toast.success(`Quiz "${quiz.title}" created with ${quiz.totalQuestions} questions`);
      utils.lecturer.quizzes.list.invalidate({ courseId });
      setQuizTitle("");
      setQuizDocId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteQuiz = trpc.lecturer.quizzes.delete.useMutation({
    onSuccess: () => {
      toast.success("Quiz deleted");
      utils.lecturer.quizzes.list.invalidate({ courseId });
      if (previewQuizId) setPreviewQuizId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const genFlashcards = trpc.lecturer.materials.generateFlashcards.useMutation({
    onSuccess: () => toast.success("Flashcards generated"),
  });
  const genSummary = trpc.lecturer.materials.generateSummary.useMutation({
    onSuccess: () => toast.success("Summary generated"),
  });

  const handleUpload = async (file: File) => {
    if (!materialTitle.trim()) {
      toast.error("Enter a title for the material");
      return;
    }
    setUploading(true);
    try {
      const fileKey = `courses/${courseId}/${Date.now()}-${file.name}`;
      const buffer = await file.arrayBuffer();
      const { url, key } = await storagePut(fileKey, new Uint8Array(buffer), file.type);
      let extractedText: string | undefined;
      try {
        extractedText = await extractMutation.mutateAsync({ fileUrl: url });
      } catch {
        /* optional extraction */
      }
      await uploadMaterial.mutateAsync({
        courseId,
        title: materialTitle,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: url,
        fileKey: key,
        mimeType: file.type,
        extractedText,
        materialType,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!isAllowed || Number.isNaN(courseId)) return null;
  if (!course) return (
    <DashboardLayout>
      <p className="text-muted-foreground">Loading course...</p>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <Button variant="ghost" className="gap-2 -ml-2" onClick={() => setLocation("/lecturer/courses")}>
          <ArrowLeft className="h-4 w-4" /> Back to courses
        </Button>

        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6">
          <h1 className="text-2xl font-bold">{course.title}</h1>
          {course.subject ? <p className="text-indigo-600 font-medium">{course.subject}</p> : null}
          <p className="text-sm text-muted-foreground mt-2">
            Enrollment code: <span className="font-mono font-bold text-indigo-700">{course.code}</span>
          </p>
        </div>

        <Tabs defaultValue="materials">
          <TabsList className="rounded-2xl flex flex-wrap h-auto gap-1">
            <TabsTrigger value="materials" className="rounded-xl">Materials</TabsTrigger>
            <TabsTrigger value="quizzes" className="rounded-xl">Quizzes</TabsTrigger>
            <TabsTrigger value="students" className="rounded-xl">Students</TabsTrigger>
            <TabsTrigger value="assignments" className="rounded-xl">Assignments</TabsTrigger>
            <TabsTrigger value="announcements" className="rounded-xl">Announcements</TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="space-y-4 mt-4">
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="h-5 w-5 text-indigo-600" /> Upload material
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} placeholder="Lecture 3 - Neural Networks" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={materialType} onValueChange={(v) => setMaterialType(v as typeof materialType)}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF / Notes</SelectItem>
                        <SelectItem value="slides">Slides</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="notes">Lecture notes</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                  }}
                />
                <Button
                  className="rounded-2xl bg-indigo-600"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Uploading..." : "Select PDF, DOCX, or PPTX"}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {materials?.map((doc) => (
                <Card key={doc.id} className="rounded-2xl">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-indigo-600 mt-0.5" />
                      <div>
                        <p className="font-semibold">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.fileName} · {doc.materialType}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl gap-1" disabled={genSummary.isPending} onClick={() => genSummary.mutate({ documentId: doc.id, courseId })}>
                        <Brain className="h-3.5 w-3.5" /> Summary
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl gap-1" disabled={genFlashcards.isPending} onClick={() => genFlashcards.mutate({ documentId: doc.id, courseId, count: 10 })}>
                        <Layers className="h-3.5 w-3.5" /> Flashcards
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl gap-1" disabled={genQuiz.isPending} onClick={() => genQuiz.mutate({ documentId: doc.id, courseId, questionCount: 5 })}>
                        <Brain className="h-3.5 w-3.5" /> Quiz
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMaterial.mutate({ documentId: doc.id, courseId })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {materials?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No materials uploaded yet.</p>
              ) : null}
            </div>
          </TabsContent>

          {/* ── Quizzes tab ── */}
          <TabsContent value="quizzes" className="mt-4 space-y-4">

            {/* Generate quiz form */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                  <Brain className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Generate AI Quiz</p>
                  <p className="text-xs text-slate-500">Create a quiz from a course material using AI</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {!materials || materials.length === 0 ? (
                  <p className="text-sm text-slate-500">Upload course materials first to generate quizzes.</p>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Select material</Label>
                        <Select
                          value={quizDocId?.toString() ?? ""}
                          onValueChange={(v) => setQuizDocId(Number(v))}
                        >
                          <SelectTrigger className="rounded-xl border-slate-200">
                            <SelectValue placeholder="Choose a document..." />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((doc) => (
                              <SelectItem key={doc.id} value={doc.id.toString()}>
                                {doc.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Number of questions</Label>
                        <Select
                          value={quizCount.toString()}
                          onValueChange={(v) => setQuizCount(Number(v))}
                        >
                          <SelectTrigger className="rounded-xl border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 5, 8, 10, 15, 20].map((n) => (
                              <SelectItem key={n} value={n.toString()}>{n} questions</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Quiz title <span className="text-slate-400 text-xs">(optional)</span></Label>
                      <Input
                        value={quizTitle}
                        onChange={(e) => setQuizTitle(e.target.value)}
                        placeholder="e.g. Week 3 Assessment"
                        className="rounded-xl border-slate-200"
                        maxLength={200}
                      />
                    </div>
                    <Button
                      className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-2"
                      disabled={!quizDocId || genQuiz.isPending}
                      onClick={() => {
                        if (!quizDocId) return;
                        genQuiz.mutate({
                          courseId,
                          documentId: quizDocId,
                          questionCount: quizCount,
                          title: quizTitle || undefined,
                        });
                      }}
                    >
                      {genQuiz.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                        : <><Brain className="h-4 w-4" /> Generate Quiz</>
                      }
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Quiz list */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                    <HelpCircle className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Course Quizzes ({quizList?.length ?? 0})
                  </p>
                </div>
              </div>

              {quizzesLoading ? (
                <div className="px-6 py-8 text-center text-sm text-slate-400">Loading quizzes…</div>
              ) : !quizList || quizList.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <HelpCircle className="mx-auto h-10 w-10 text-slate-200 mb-3" />
                  <p className="text-sm font-medium text-slate-500">No quizzes yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Generate a quiz above — students will see it in their course on the mobile app.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {quizList.map((quiz) => (
                    <QuizRow
                      key={quiz.id}
                      quiz={quiz}
                      courseId={courseId}
                      isExpanded={previewQuizId === quiz.id}
                      onToggle={() => setPreviewQuizId(previewQuizId === quiz.id ? null : quiz.id)}
                      onDelete={() => deleteQuiz.mutate({ quizId: quiz.id, courseId })}
                      deleting={deleteQuiz.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="students" className="mt-4 space-y-4">
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Enroll student</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input placeholder="student@university.edu" value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} />
                <Button className="bg-indigo-600 rounded-2xl" onClick={() => enrollStudent.mutate({ courseId, email: enrollEmail })}>Add</Button>
              </CardContent>
            </Card>
            {students?.map((s) => (
              <Card key={s.studentId} className="rounded-2xl">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeStudent.mutate({ courseId, studentId: s.studentId })}>Remove</Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="assignments" className="mt-4 space-y-4">
            <Card className="rounded-3xl">
              <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> New assignment</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Title" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} />
                <Textarea placeholder="Description" value={assignDesc} onChange={(e) => setAssignDesc(e.target.value)} />
                <Input type="datetime-local" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} />
                <Button className="bg-indigo-600 rounded-2xl" onClick={() => createAssignment.mutate({
                  courseId,
                  title: assignTitle,
                  description: assignDesc || undefined,
                  dueDate: assignDue ? new Date(assignDue) : undefined,
                })}>Create assignment</Button>
              </CardContent>
            </Card>
            {assignments?.map((a) => (
              <Card key={a.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="font-semibold">{a.title}</p>
                  {a.description ? <p className="text-sm text-muted-foreground mt-1">{a.description}</p> : null}
                  {a.dueDate ? <p className="text-xs text-indigo-600 mt-2">Due: {new Date(a.dueDate).toLocaleString()}</p> : null}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="announcements" className="mt-4 space-y-4">
            <Card className="rounded-3xl">
              <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Post announcement</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
                <Textarea placeholder="Message to students" value={annContent} onChange={(e) => setAnnContent(e.target.value)} rows={4} />
                <Button className="bg-indigo-600 rounded-2xl" onClick={() => createAnnouncement.mutate({ courseId, title: annTitle, content: annContent })}>Publish</Button>
              </CardContent>
            </Card>
            {announcements?.map((a) => (
              <Card key={a.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(a.createdAt).toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ── Quiz row with expandable question preview ─────────────────────────────────

function QuizRow({
  quiz,
  courseId,
  isExpanded,
  onToggle,
  onDelete,
  deleting,
}: {
  quiz: { id: number; title: string; totalQuestions: number; createdAt: Date | string };
  courseId: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { data: detail } = trpc.lecturer.quizzes.get.useQuery(
    { quizId: quiz.id, courseId },
    { enabled: isExpanded }
  );

  return (
    <div>
      {/* Row header */}
      <div className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50">
          <HelpCircle className="h-4 w-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{quiz.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {quiz.totalQuestions} questions ·{" "}
            {new Date(quiz.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Visible to students
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-600"
            onClick={onToggle}
            title={isExpanded ? "Collapse" : "Preview questions"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => {
              if (confirm(`Delete "${quiz.title}"? Students will no longer see this quiz.`)) {
                onDelete();
              }
            }}
            disabled={deleting}
            title="Delete quiz"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded question preview */}
      {isExpanded && (
        <div className="border-t border-slate-50 bg-slate-50/50 px-6 py-4 space-y-3">
          {!detail ? (
            <p className="text-sm text-slate-400">Loading questions…</p>
          ) : (
            detail.questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800 mb-3">
                  <span className="text-violet-600 mr-1.5">Q{idx + 1}.</span>
                  {q.question}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(q.options as string[]).map((opt) => (
                    <div
                      key={opt}
                      className={[
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                        opt === q.correctAnswer
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {opt === q.correctAnswer
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />}
                      {opt}
                    </div>
                  ))}
                </div>
                {q.explanation ? (
                  <p className="mt-2 text-xs text-slate-500 italic">
                    <span className="font-medium not-italic">Explanation:</span> {q.explanation}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
