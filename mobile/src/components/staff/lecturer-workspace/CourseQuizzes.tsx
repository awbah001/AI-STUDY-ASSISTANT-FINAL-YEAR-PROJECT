import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { trpc } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import {
  useLecturerQuizLength,
  QUIZ_LENGTHS,
} from "../../../lib/lecturerPreferences";
import {
  Card,
  ChipSelect,
  EmptyState,
  FormField,
  Loading,
  PrimaryButton,
  SectionHeader,
  formatDate,
} from "../StaffUi";
import { BottomSheet } from "./Sheet";
import {
  courseStyles as baseStyles,
  courseError,
  courseDeadlineError,
  parseCourseDeadline,
  confirmCourseDelete,
} from "./courseTools";
import { LIMITS, useFieldErrors, validateText } from "../../../lib/validation";

export function CourseQuizzes({ courseId }: { courseId: number }) {
  const st = useStaffStyles(baseStyles);

  const { user } = useAuth();
  const defaults = useLecturerQuizLength(user?.id);
  const [count, setCount] = useState(5);
  useEffect(() => {
    if (defaults.loaded) setCount(defaults.quizLength);
  }, [defaults.loaded, defaults.quizLength]);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const { errors, check, clear } = useFieldErrors<"title" | "due">();
  const [preview, setPreview] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const materials = trpc.lecturer.materials.list.useQuery({ courseId });
  const list = trpc.lecturer.quizzes.list.useQuery({ courseId });
  const detail = trpc.lecturer.quizzes.get.useQuery(
    { courseId, quizId: preview ?? 0 },
    { enabled: preview !== null }
  );
  const generate = trpc.lecturer.quizzes.generate.useMutation({
    onSuccess: () => {
      setTitle("");
      setDue("");
      setDocumentId(null);
      void utils.lecturer.invalidate();
      Alert.alert("Quiz created", "Students can now take this quiz.");
    },
    onError: courseError,
  });
  const remove = trpc.lecturer.quizzes.delete.useMutation({
    onSuccess: () => {
      setPreview(null);
      void utils.lecturer.invalidate();
    },
    onError: courseError,
  });
  return (
    <>
      <Card>
        <Text style={st.title}>Generate a quiz</Text>
        <Text style={st.meta}>
          Choose a course material. Your saved teaching preference sets the
          initial question count.
        </Text>
        {materials.isLoading ? (
          <Loading />
        ) : materials.error ? (
          <>
            <Text style={st.meta}>{materials.error.message}</Text>
            <PrimaryButton
              label="Retry materials"
              onPress={() => void materials.refetch()}
            />
          </>
        ) : !materials.data?.length ? (
          <EmptyState
            icon="document-outline"
            text="Upload a material in the Materials tab first."
          />
        ) : (
          <ChipSelect
            value={documentId}
            onChange={setDocumentId}
            options={materials.data.map(d => ({ value: d.id, label: d.title }))}
          />
        )}
        <FormField
          label="Quiz title (optional)"
          value={title}
          onChangeText={v => {
            setTitle(v);
            clear("title");
          }}
          maxLength={LIMITS.title.max}
          error={errors.title}
        />
        <ChipSelect
          value={count}
          onChange={setCount}
          options={QUIZ_LENGTHS.map(n => ({
            value: n,
            label: `${n} questions`,
          }))}
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
        <PrimaryButton
          label="Generate quiz"
          icon="sparkles-outline"
          loading={generate.isPending}
          disabled={!documentId || !defaults.loaded}
          onPress={() => {
            const ok = check({
              title: validateText(title, { label: "Quiz title", required: false, max: LIMITS.title.max }),
              due: courseDeadlineError(due),
            });
            if (!ok) return;
            try {
              if (documentId)
                generate.mutate({
                  courseId,
                  documentId,
                  questionCount: count,
                  title: title.trim() || undefined,
                  dueDate: parseCourseDeadline(due),
                });
            } catch (e) {
              courseError(e);
            }
          }}
        />
      </Card>
      <SectionHeader title="Course quizzes" />
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <>
          <EmptyState icon="cloud-offline-outline" text={list.error.message} />
          <PrimaryButton
            label="Retry quizzes"
            onPress={() => void list.refetch()}
          />
        </>
      ) : !list.data?.length ? (
        <EmptyState
          icon="help-circle-outline"
          text="No quizzes yet. Generate one from your course materials."
        />
      ) : (
        list.data.map(q => (
          <Card key={q.id}>
            <Text style={st.title}>{q.title}</Text>
            <Text style={st.meta}>
              {q.totalQuestions} questions · {formatDate(q.createdAt)}
            </Text>
            <View style={st.actions}>
              <PrimaryButton
                label="Preview questions"
                variant="outline"
                onPress={() => setPreview(q.id)}
              />
              <PrimaryButton
                label="Delete quiz"
                variant="danger"
                disabled={remove.isPending}
                onPress={() =>
                  confirmCourseDelete(q.title, () =>
                    remove.mutate({ courseId, quizId: q.id })
                  )
                }
              />
            </View>
          </Card>
        ))
      )}
      <BottomSheet
        visible={preview !== null}
        onClose={() => setPreview(null)}
        title={detail.data?.title || "Quiz preview"}
      >
        {detail.isLoading ? (
          <Loading />
        ) : detail.error ? (
          <>
            <Text style={st.text}>{detail.error.message}</Text>
            <PrimaryButton
              label="Retry preview"
              onPress={() => void detail.refetch()}
            />
          </>
        ) : (
          detail.data?.questions.map((q, index) => (
            <Card key={q.id}>
              <Text style={st.title}>
                {index + 1}. {q.question}
              </Text>
              {q.options.map((option, i) => (
                <Text
                  key={i}
                  style={option === q.correctAnswer ? st.correct : st.option}
                >
                  {option === q.correctAnswer ? "✓ " : ""}
                  {option}
                </Text>
              ))}
              {q.explanation && (
                <Text style={st.text}>Explanation: {q.explanation}</Text>
              )}
            </Card>
          ))
        )}
      </BottomSheet>
    </>
  );
}
