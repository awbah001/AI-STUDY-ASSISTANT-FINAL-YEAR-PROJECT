import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { trpc } from "../../../lib/api";
import { uploadFile, type PickedFile } from "../../../lib/uploadFile";
import {
  Badge,
  Card,
  ChipSelect,
  EmptyState,
  FormField,
  Loading,
  PrimaryButton,
  SectionHeader,
  formatDate,
} from "../StaffUi";
import {
  courseStyles as baseStyles,
  courseError,
  courseDeadlineError,
  parseCourseDeadline,
  pickCourseFile,
  openCourseFile,
  confirmCourseDelete,
} from "./courseTools";
import { SimilaritySheet } from "./SimilaritySheet";
import { LIMITS, parseRubricText, useFieldErrors, validateText } from "../../../lib/validation";

export function CourseAssignments({ courseId }: { courseId: number }) {
  const st = useStaffStyles(baseStyles);

  const utils = trpc.useUtils();
  const query = trpc.lecturer.assignments.list.useQuery({ courseId });
  const templates = trpc.lecturer.assignments.templates.list.useQuery();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [rubric, setRubric] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [similarityFor, setSimilarityFor] = useState<{ id: number; title: string } | null>(null);
  const { errors, check, clear, reset } = useFieldErrors<"title" | "description" | "due" | "rubric">();
  const create = trpc.lecturer.assignments.create.useMutation();
  const remove = trpc.lecturer.assignments.delete.useMutation({
    onSuccess: () => utils.lecturer.invalidate(),
    onError: courseError,
  });
  const submit = async () => {
    if (busy) return;
    const { rubric: criteria, error: rubricError } = parseRubricText(rubric);
    const ok = check({
      title: validateText(title, { label: "Title", ...LIMITS.title }),
      description: validateText(description, { label: "Instructions", required: false, max: LIMITS.description }),
      due: courseDeadlineError(due),
      rubric: rubricError,
    });
    if (!ok) return;
    try {
      const dueDate = parseCourseDeadline(due);
      setBusy(true);
      const stored = file
        ? await uploadFile(file, `assignments/${courseId}`)
        : null;
      await create.mutateAsync({
        courseId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        rubric: criteria,
        ...(stored
          ? {
              fileUrl: stored.url,
              fileKey: stored.key,
              fileName: stored.name,
              fileSize: stored.size,
              mimeType: stored.mimeType,
            }
          : {}),
      });
      setTitle("");
      setDescription("");
      setDue("");
      setRubric("");
      setTemplateId(null);
      setFile(null);
      reset();
      setOpen(false);
      await utils.lecturer.invalidate();
      Alert.alert(
        "Assignment created",
        "Enrolled students have been notified."
      );
    } catch (e) {
      courseError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PrimaryButton
        label={open ? "Close assignment form" : "New assignment"}
        icon="add"
        variant="outline"
        disabled={busy}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <Card>
          <SectionHeader title="Create assignment" />
          {templates.data?.length ? (
            <>
              <Text style={st.meta}>Use an assessment template</Text>
              <ChipSelect
                value={templateId}
                onChange={id => {
                  const t = templates.data.find(t => t.id === id);
                  if (t) {
                    reset();
                    setTemplateId(id);
                    setTitle(t.title);
                    setDescription(t.description || "");
                    setRubric(
                      t.rubric
                        ?.map(r => `${r.criterion}: ${r.maxPoints}`)
                        .join(", ") || ""
                    );
                  }
                }}
                options={templates.data.map(t => ({
                  value: t.id,
                  label: t.name,
                }))}
              />
            </>
          ) : null}
          {templates.error && (
            <PrimaryButton
              label="Retry templates"
              onPress={() => void templates.refetch()}
            />
          )}
          <FormField
            label="Title"
            value={title}
            onChangeText={v => {
              setTitle(v);
              clear("title");
            }}
            maxLength={LIMITS.title.max}
            error={errors.title}
          />
          <FormField
            label="Instructions"
            value={description}
            onChangeText={v => {
              setDescription(v);
              clear("description");
            }}
            multiline
            maxLength={LIMITS.description}
            error={errors.description}
          />
          <FormField
            label="Deadline (optional, local time)"
            value={due}
            onChangeText={v => {
              setDue(v);
              clear("due");
            }}
            placeholder="YYYY-MM-DD HH:mm"
            maxLength={16}
            error={errors.due}
          />
          <FormField
            label="Rubric (optional)"
            value={rubric}
            onChangeText={v => {
              setRubric(v);
              clear("rubric");
            }}
            placeholder="Research: 30, Analysis: 40, Presentation: 30"
            multiline
            error={errors.rubric}
          />
          <Text style={st.meta}>
            Attachment: PDF, Word, or PowerPoint, up to 60 MB.
          </Text>
          <View style={st.actions}>
            <PrimaryButton
              label={file?.name || "Attach file (optional)"}
              disabled={busy}
              variant="outline"
              onPress={() => {
                void pickCourseFile()
                  .then(f => {
                    if (f) setFile(f);
                  })
                  .catch(courseError);
              }}
            />
            {file && (
              <PrimaryButton
                label="Remove attachment"
                variant="outline"
                disabled={busy}
                onPress={() => setFile(null)}
              />
            )}
            <PrimaryButton
              label="Create assignment"
              loading={busy}
              onPress={() => void submit()}
            />
          </View>
        </Card>
      )}
      <SectionHeader title="Course assignments" />
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <>
          <EmptyState icon="cloud-offline-outline" text={query.error.message} />
          <PrimaryButton
            label="Retry assignments"
            onPress={() => void query.refetch()}
          />
        </>
      ) : !query.data?.length ? (
        <EmptyState
          icon="clipboard-outline"
          text="No assignments for this course yet."
        />
      ) : (
        query.data.map(a => (
          <Card key={a.id}>
            <Text style={st.title}>{a.title}</Text>
            <Text style={st.text}>{a.description}</Text>
            <Text style={st.meta}>
              {a.dueDate
                ? `Due ${formatDate(a.dueDate)} ${new Date(a.dueDate).toLocaleTimeString()}`
                : "No due date"}
            </Text>
            {a.rubric?.length ? (
              <>
                <Badge label="Rubric" />
                {a.rubric.map(r => (
                  <Text key={r.criterion} style={st.meta}>
                    {r.criterion}: {r.maxPoints} points
                  </Text>
                ))}
              </>
            ) : null}
            <View style={st.actions}>
              {a.fileUrl && (
                <PrimaryButton
                  label={a.fileName || "Open attachment"}
                  variant="outline"
                  onPress={() => openCourseFile(a.fileUrl!)}
                />
              )}
              <PrimaryButton
                label="Check similarity"
                icon="git-compare-outline"
                variant="outline"
                onPress={() => setSimilarityFor({ id: a.id, title: a.title })}
              />
              <PrimaryButton
                label="Delete assignment"
                variant="danger"
                disabled={remove.isPending}
                onPress={() =>
                  confirmCourseDelete(a.title, () =>
                    remove.mutate({ assignmentId: a.id })
                  )
                }
              />
            </View>
          </Card>
        ))
      )}
      <SimilaritySheet assignment={similarityFor} onClose={() => setSimilarityFor(null)} />
    </>
  );
}
