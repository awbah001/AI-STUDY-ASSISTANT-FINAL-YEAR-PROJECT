import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { storagePut } from "@/lib/storage";
import { apiUrl } from "@/lib/apiBaseUrl";
import { useRoute, useLocation } from "wouter";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  getStudyFileExtension,
  isAllowedStudyDocument,
  studyFormatLabel,
  STUDY_DOC_ACCEPT,
  STUDY_DOC_ERROR,
  STUDY_DOC_HELP,
} from "@shared/studyDocuments";
import {
  Upload, Users, FileText, Megaphone, ClipboardList,
  Brain, Layers, Trash2, ArrowLeft, HelpCircle,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2,
} from "lucide-react";

type StudyFormat = "pdf" | "docx" | "pptx";

export default function LecturerCourseDetail() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [, params] = useRoute("/lecturer/courses/:id");
  const [, setLocation] = useLocation();
  const courseId = Number(params?.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const assignFileRef = useRef<HTMLInputElement>(null);

  const [enrollEmail, setEnrollEmail] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState<StudyFormat>("pdf");
  const [uploading, setUploading] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignRubric, setAssignRubric] = useState("");
  const [assignFile, setAssignFile] = useState<File | null>(null);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [templateId, setTemplateId] = useState("");

  const [quizDocId, setQuizDocId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizDue, setQuizDue] = useState("");
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
  const { data: assessmentTemplates } = trpc.lecturer.assignments.templates.list.useQuery(undefined, { enabled: isAllowed });

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
      setAssignRubric("");
      setTemplateId("");
      setAssignFile(null);
      if (assignFileRef.current) assignFileRef.current.value = "";
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteAssignment = trpc.lecturer.assignments.delete.useMutation({
    onSuccess: () => {
      toast.success("Assignment deleted");
      utils.lecturer.assignments.list.invalidate({ courseId });
    },
    onError: (e) => toast.error(e.message),
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
      setQuizDue("");
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
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!isAllowedStudyDocument(file.name, file.type)) {
      toast.error(STUDY_DOC_ERROR);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 60 MB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const ext = getStudyFileExtension(file.name);
    const format: StudyFormat = ext === "docx" || ext === "pptx" ? ext : "pdf";
    setMaterialType(format);
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
        materialType: format,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignTitle.trim()) return;
    const rubric = assignRubric.trim()
      ? assignRubric.split(",").map((part) => {
          const [criterion, points] = part.split(":");
          return { criterion: criterion?.trim(), maxPoints: Number(points?.trim()) };
        }).filter((item): item is { criterion: string; maxPoints: number } => !!item.criterion && Number.isFinite(item.maxPoints) && item.maxPoints > 0)
      : undefined;
    if (assignRubric.trim() && (!rubric || rubric.length === 0)) {
      toast.error("Use rubric format such as Research: 30, Analysis: 40");
      return;
    }
    setCreatingAssignment(true);
    try {
    let fileUrl: string | undefined;
    let fileKey: string | undefined;
    let fileName: string | undefined;
    let fileSize: number | undefined;
    let mimeType: string | undefined;
    if (assignFile) {
      if (!isAllowedStudyDocument(assignFile.name, assignFile.type)) {
        toast.error(STUDY_DOC_ERROR);
        return;
      }
      if (assignFile.size > 60 * 1024 * 1024) {
        toast.error("File is too large. Maximum size is 60 MB.");
        return;
      }
      try {
        const key = `assignments/${courseId}/${Date.now()}-${assignFile.name}`;
        const buffer = await assignFile.arrayBuffer();
        const uploaded = await storagePut(key, new Uint8Array(buffer), assignFile.type);
        fileUrl = uploaded.url;
        fileKey = uploaded.key;
        fileName = assignFile.name;
        fileSize = assignFile.size;
        mimeType = assignFile.type;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "File upload failed");
        return;
      }
    }
    await createAssignment.mutateAsync({
      courseId,
      title: assignTitle,
      description: assignDesc || undefined,
      dueDate: assignDue ? new Date(assignDue) : undefined,
      rubric,
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      mimeType,
    });
    } finally {
      setCreatingAssignment(false);
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

        <div className="rounded-2xl border border-indigo-100 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
              {course.subject ? <p className="text-indigo-600 font-medium mt-0.5">{course.subject}</p> : null}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Enrollment code</p>
              <p className="font-mono font-bold text-indigo-700 text-lg tracking-widest">{course.code}</p>
            </div>
          </div>
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
            {/* Upload form */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                  <Upload className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Upload Material</p>
                  <p className="text-xs text-slate-500">{STUDY_DOC_HELP}. Other formats are blocked so students can use AI chat, quizzes, and flashcards.</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} placeholder="Lecture 3 - Neural Networks" className="rounded-xl border-slate-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Format</Label>
                    <Select value={materialType} onValueChange={(v) => setMaterialType(v as StudyFormat)}>
                      <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="docx">Word (.docx)</SelectItem>
                        <SelectItem value="pptx">PowerPoint (.pptx)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <input ref={fileRef} type="file" className="hidden"
                  accept={STUDY_DOC_ACCEPT}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }}
                />
                <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading..." : "Select file to upload"}
                </Button>
              </div>
            </div>

            {/* Materials list */}
            {materials && materials.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                    <FileText className="h-4 w-4 text-slate-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Uploaded Materials ({materials.length})</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {materials.map((doc) => (
                    <div key={doc.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                          <FileText className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{doc.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{doc.fileName} · {studyFormatLabel(doc.materialType, doc.fileName)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs" disabled={genSummary.isPending} onClick={() => genSummary.mutate({ documentId: doc.id, courseId })}>
                          <Brain className="h-3.5 w-3.5" /> Summary
                        </Button>
                        <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs" disabled={genFlashcards.isPending} onClick={() => genFlashcards.mutate({ documentId: doc.id, courseId, count: 10 })}>
                          <Layers className="h-3.5 w-3.5" /> Flashcards
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteMaterial.mutate({ documentId: doc.id, courseId })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {materials?.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No materials uploaded yet.</p>
              </div>
            )}
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
                    <div className="space-y-1.5">
                      <Label>Quiz deadline <span className="text-slate-400 text-xs">(optional)</span></Label>
                      <Input type="datetime-local" value={quizDue} onChange={(e) => setQuizDue(e.target.value)} className="rounded-xl border-slate-200" />
                    </div>
                    <Button
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      disabled={!quizDocId || genQuiz.isPending}
                      onClick={() => {
                        if (!quizDocId) return;
                        genQuiz.mutate({
                          courseId,
                          documentId: quizDocId,
                          questionCount: quizCount,
                          title: quizTitle || undefined,
                          dueDate: quizDue ? new Date(quizDue) : undefined,
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
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                  <Users className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Enroll Student</p>
                  <p className="text-xs text-slate-500">Enter student email to add them to this course</p>
                </div>
              </div>
              <div className="flex gap-2 p-6">
                <Input placeholder="student@university.edu" value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} className="rounded-xl border-slate-200" />
                <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" onClick={() => enrollStudent.mutate({ courseId, email: enrollEmail })}>Add</Button>
              </div>
            </div>

            {students && students.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                  <p className="text-sm font-semibold text-slate-800">Enrolled Students ({students.length})</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {students.map((s) => (
                    <div key={s.studentId} className="flex items-center justify-between gap-4 px-6 py-3">
                      <div className="flex items-center gap-3">
                        {s.avatarUrl ? (
                          <img
                            src={s.avatarUrl}
                            alt={s.name ?? ""}
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                            {s.name?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 text-xs gap-1" onClick={() => removeStudent.mutate({ courseId, studentId: s.studentId })}>
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {students?.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No students enrolled yet.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50">
                  <ClipboardList className="h-4 w-4 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">New Assignment</p>
                  <p className="text-xs text-slate-500">Create a task or project for enrolled students</p>
                </div>
              </div>
              <div className="p-6 space-y-3">
                {assessmentTemplates && assessmentTemplates.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Start from saved template</Label>
                    <Select value={templateId} onValueChange={(value) => { setTemplateId(value); const template = assessmentTemplates.find((item) => String(item.id) === value); if (template) { setAssignTitle(template.title); setAssignDesc(template.description ?? ""); setAssignRubric((template.rubric ?? []).map((item) => `${item.criterion}:${item.maxPoints}`).join(", ")); } }}>
                      <SelectTrigger className="rounded-xl border-slate-200"><SelectValue placeholder="Choose a template (optional)" /></SelectTrigger>
                      <SelectContent>{assessmentTemplates.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <Input placeholder="Title" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} className="rounded-xl border-slate-200" />
                <Textarea placeholder="Description (optional)" value={assignDesc} onChange={(e) => setAssignDesc(e.target.value)} className="rounded-xl border-slate-200" />
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Rubric <span className="font-normal">(optional, Criterion: points, separated by commas)</span></Label>
                  <Input placeholder="Research: 30, Analysis: 40, Presentation: 30" value={assignRubric} onChange={(e) => setAssignRubric(e.target.value)} className="rounded-xl border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Due date (optional)</Label>
                  <Input type="datetime-local" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} className="rounded-xl border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Assignment document (optional)</Label>
                  <input
                    ref={assignFileRef}
                    type="file"
                    className="hidden"
                    accept={STUDY_DOC_ACCEPT}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!isAllowedStudyDocument(f.name, f.type)) {
                        toast.error(STUDY_DOC_ERROR);
                        e.target.value = "";
                        setAssignFile(null);
                        return;
                      }
                      setAssignFile(f);
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" className="rounded-xl border-slate-200 gap-2" onClick={() => assignFileRef.current?.click()}>
                      <Upload className="h-4 w-4" />
                      {assignFile ? "Change file" : "Attach file"}
                    </Button>
                    {assignFile ? (
                      <span className="text-sm text-slate-600">
                        {assignFile.name}
                        <button
                          type="button"
                          className="ml-2 text-red-500 hover:text-red-700 text-xs"
                          onClick={() => {
                            setAssignFile(null);
                            if (assignFileRef.current) assignFileRef.current.value = "";
                          }}
                        >
                          Remove
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">{STUDY_DOC_HELP}</span>
                    )}
                  </div>
                </div>
                <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2" disabled={!assignTitle.trim() || creatingAssignment || createAssignment.isPending} onClick={() => void handleCreateAssignment()}>
                  <ClipboardList className="h-4 w-4" />
                  {creatingAssignment || createAssignment.isPending ? "Creating..." : "Create assignment"}
                </Button>
              </div>
            </div>

            {assignments && assignments.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                  <p className="text-sm font-semibold text-slate-800">Assignments ({assignments.length})</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {assignments.map((a) => (
                    <div key={a.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{a.title}</p>
                          {a.description && <p className="text-sm text-slate-500 mt-1">{a.description}</p>}
                          {a.fileUrl && (
                            <a
                              href={a.fileUrl.startsWith("http") ? a.fileUrl : apiUrl(a.fileUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {a.fileName ?? "Download document"}
                            </a>
                          )}
                          {a.dueDate && (
                            <p className="text-xs text-cyan-600 font-medium mt-1.5">
                              Due: {new Date(a.dueDate).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          disabled={deleteAssignment.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete assignment “${a.title}”? Student submissions for it will also be removed.`)) {
                              deleteAssignment.mutate({ assignmentId: a.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {assignments?.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No assignments yet.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="announcements" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
                  <Megaphone className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Post Announcement</p>
                  <p className="text-xs text-slate-500">Send an update to all students in this course</p>
                </div>
              </div>
              <div className="p-6 space-y-3">
                <Input placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} className="rounded-xl border-slate-200" />
                <Textarea placeholder="Message to students..." value={annContent} onChange={(e) => setAnnContent(e.target.value)} rows={4} className="rounded-xl border-slate-200" />
                <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2" disabled={!annTitle.trim() || !annContent.trim() || createAnnouncement.isPending} onClick={() => createAnnouncement.mutate({ courseId, title: annTitle, content: annContent })}>
                  <Megaphone className="h-4 w-4" />
                  {createAnnouncement.isPending ? "Publishing..." : "Publish announcement"}
                </Button>
              </div>
            </div>

            {announcements && announcements.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                  <p className="text-sm font-semibold text-slate-800">Posted Announcements ({announcements.length})</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {announcements.map((a) => (
                    <div key={a.id} className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{a.title}</p>
                      <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-wrap">{a.content}</p>
                      <p className="text-xs text-slate-400 mt-2">{new Date(a.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {announcements?.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                <Megaphone className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No announcements posted yet.</p>
              </div>
            )}
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
