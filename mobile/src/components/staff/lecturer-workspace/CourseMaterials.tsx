import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { trpc } from "../../../lib/api";
import { uploadFile, type PickedFile } from "../../../lib/uploadFile";
import {
  Card,
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
  pickCourseFile,
  openCourseFile,
  confirmCourseDelete,
} from "./courseTools";
import { FieldError } from "../../FieldError";
import { LIMITS, titleFromFileName, useFieldErrors, validateText } from "../../../lib/validation";

export function CourseMaterials({ courseId }: { courseId: number }) {
  const st = useStaffStyles(baseStyles);

  const utils = trpc.useUtils();
  const query = trpc.lecturer.materials.list.useQuery({ courseId });
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const { errors, check, clear } = useFieldErrors<"title" | "file">();
  const extract = trpc.documents.extractDocumentText.useMutation();
  const upload = trpc.lecturer.materials.upload.useMutation();
  const remove = trpc.lecturer.materials.delete.useMutation({
    onSuccess: () => utils.lecturer.invalidate(),
    onError: courseError,
  });
  const cards = trpc.lecturer.materials.generateFlashcards.useMutation({
    onSuccess: () => {
      void utils.lecturer.dashboardStats.invalidate();
      Alert.alert(
        "Flashcards generated",
        "The flashcards are ready for students."
      );
    },
    onError: courseError,
  });
  const summary = trpc.lecturer.materials.generateSummary.useMutation({
    onSuccess: () =>
      Alert.alert(
        "Summary generated",
        "The summary is available in the study workspace."
      ),
    onError: courseError,
  });
  const submit = async () => {
    if (busy) return;
    const ok = check({
      title: validateText(title, { label: "Material title", ...LIMITS.title }),
      file: file ? null : "Choose a file to upload.",
    });
    if (!ok || !file) return;
    setBusy(true);
    try {
      const stored = await uploadFile(file, `courses/${courseId}`);
      let extractedText: string | undefined;
      try {
        extractedText = await extract.mutateAsync({ fileUrl: stored.url });
      } catch {
        /* AI actions can retry extraction later. */
      }
      const extension = file.name.split(".").pop()?.toLowerCase();
      await upload.mutateAsync({
        courseId,
        title: title.trim(),
        fileName: file.name,
        fileSize: file.size,
        fileUrl: stored.url,
        fileKey: stored.key,
        mimeType: file.mimeType,
        materialType:
          extension === "docx" || extension === "pptx" ? extension : "pdf",
        extractedText,
      });
      setTitle("");
      setFile(null);
      await utils.lecturer.invalidate();
      Alert.alert(
        "Material uploaded",
        "Students can now access this material."
      );
    } catch (error) {
      courseError(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Card>
        <FormField
          label="Material title"
          value={title}
          onChangeText={v => {
            setTitle(v);
            clear("title");
          }}
          placeholder="e.g. Week 1 lecture notes"
          maxLength={LIMITS.title.max}
          error={errors.title}
        />
        <Text style={st.meta}>
          PDF, Word (.docx), or PowerPoint (.pptx), up to 60 MB.
        </Text>
        <View style={st.actions}>
          <PrimaryButton
            label={file?.name || "Choose file"}
            variant="outline"
            icon="document-attach-outline"
            disabled={busy}
            onPress={() => {
              void pickCourseFile()
                .then(f => {
                  if (f) {
                    setFile(f);
                    clear("file");
                    if (!title.trim()) setTitle(titleFromFileName(f.name));
                  }
                })
                .catch(courseError);
            }}
          />
          <FieldError message={errors.file} />
          <PrimaryButton
            label="Upload material"
            icon="cloud-upload-outline"
            loading={busy}
            onPress={() => void submit()}
          />
        </View>
      </Card>
      <SectionHeader title="Course materials" />
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <>
          <EmptyState icon="cloud-offline-outline" text={query.error.message} />
          <PrimaryButton label="Retry" onPress={() => void query.refetch()} />
        </>
      ) : !query.data?.length ? (
        <EmptyState icon="document-outline" text="No materials uploaded yet." />
      ) : (
        query.data.map(doc => (
          <Card key={doc.id}>
            <Text style={st.title}>{doc.title}</Text>
            <Text style={st.meta}>
              {doc.fileName} · {Math.round(doc.fileSize / 1024)} KB ·{" "}
              {formatDate(doc.createdAt)}
            </Text>
            <View style={st.actions}>
              <PrimaryButton
                label="Open file"
                variant="outline"
                onPress={() => openCourseFile(doc.fileUrl)}
              />
              <PrimaryButton
                label="Generate flashcards"
                icon="albums-outline"
                loading={
                  cards.isPending && cards.variables?.documentId === doc.id
                }
                disabled={cards.isPending}
                onPress={() =>
                  cards.mutate({ courseId, documentId: doc.id, count: 10 })
                }
              />
              <PrimaryButton
                label="Generate summary"
                icon="sparkles-outline"
                loading={
                  summary.isPending && summary.variables?.documentId === doc.id
                }
                disabled={summary.isPending}
                onPress={() => summary.mutate({ courseId, documentId: doc.id })}
              />
              <PrimaryButton
                label="Delete material"
                variant="danger"
                disabled={remove.isPending}
                onPress={() =>
                  confirmCourseDelete(doc.title, () =>
                    remove.mutate({ courseId, documentId: doc.id })
                  )
                }
              />
            </View>
          </Card>
        ))
      )}
    </>
  );
}
