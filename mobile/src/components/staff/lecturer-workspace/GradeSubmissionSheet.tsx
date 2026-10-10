import { design } from "../../../theme/design";
import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../../lib/api";
import { resolveFileUrl } from "../../../lib/uploadFile";
import { colors } from "../../../theme/colors";
import { Badge, formatDate, FormField, PrimaryButton } from "../StaffUi";
import { BottomSheet } from "./Sheet";
import { submissionStatus, type ReviewSubmission } from "./helpers";
import { FieldError } from "../../FieldError";
import { useFieldErrors, validateNumber, validateText } from "../../../lib/validation";

const FEEDBACK_MAX = 3000;

export function GradeSubmissionSheet({
  submission,
  onClose,
}: {
  submission: ReviewSubmission | null;
  onClose: () => void;
}) {
  const st = useStaffStyles(baseStyles);

  return (
    <BottomSheet
      visible={!!submission}
      onClose={onClose}
      title={
        submission
          ? submission.status === "graded"
            ? "Edit grade"
            : "Grade submission"
          : null
      }
      subtitle={
        submission
          ? `${submission.assignmentTitle} · ${submission.studentName ?? "Student"}`
          : null
      }
    >
      {submission ? (
        <GradeForm
          key={submission.id}
          submission={submission}
          onDone={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function GradeForm({
  submission,
  onDone,
}: {
  submission: ReviewSubmission;
  onDone: () => void;
}) {
  const st = useStaffStyles(baseStyles);

  const utils = trpc.useUtils();
  const rubric = submission.rubric ?? [];
  const [grade, setGrade] = useState(submission.grade ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (submission.rubricScores ?? []).map(item => [
        item.criterion,
        String(item.score),
      ])
    )
  );
  const { errors, check, clear } = useFieldErrors<"mark" | "feedback">();
  const status = submissionStatus(submission);
  const total = rubric.reduce(
    (sum, item) => sum + (Number(scores[item.criterion] ?? 0) || 0),
    0
  );
  const maxTotal = rubric.reduce((sum, item) => sum + item.maxPoints, 0);

  const mutation = trpc.lecturer.assignments.gradeSubmission.useMutation({
    onSuccess: () => {
      void utils.lecturer.assignments.reviewQueue.invalidate();
      void utils.lecturer.assignments.interventionStudents.invalidate();
      onDone();
      Alert.alert("Grade sent", "Grade and feedback sent to the student.");
    },
    onError: err => Alert.alert("Could not save grade", err.message),
  });

  const submit = () => {
    const rubricScores = rubric.map(item => ({
      criterion: item.criterion,
      score: Number(scores[item.criterion] ?? 0),
    }));
    const calculated = rubric.length
      ? rubricScores.reduce((sum, item) => sum + item.score, 0)
      : Number(grade);
    const scoreError = rubric
      .map(item =>
        validateNumber(scores[item.criterion] ?? "", {
          label: item.criterion,
          min: 0,
          max: item.maxPoints,
        })
      )
      .find(Boolean);
    const ok = check({
      mark: rubric.length
        ? scoreError ?? null
        : validateNumber(grade, { label: "Mark", min: 0, max: 1000 }),
      feedback: validateText(feedback, { label: "Feedback", required: false, max: FEEDBACK_MAX }),
    });
    if (!ok) return;
    mutation.mutate({
      submissionId: submission.id,
      grade: calculated,
      feedback: feedback.trim() || undefined,
      rubricScores: rubric.length ? rubricScores : undefined,
    });
  };

  const openFile = (url: string) =>
    void Linking.openURL(resolveFileUrl(url)).catch(() =>
      Alert.alert("Cannot open file", "No app is available to open this file.")
    );

  return (
    <View>
      <View style={st.metaRow}>
        <Badge label={status.label} tone={status.tone} />
        <Text style={st.metaText}>
          Submitted {formatDate(submission.submittedAt)}
          {submission.dueDate ? ` · Due ${formatDate(submission.dueDate)}` : ""}
        </Text>
      </View>
      {submission.studentEmail ? (
        <Text style={st.email}>{submission.studentEmail}</Text>
      ) : null}
      {submission.note ? (
        <View style={st.noteBox}>
          <Text style={st.noteLabel}>Student note</Text>
          <Text style={st.noteText}>{submission.note}</Text>
        </View>
      ) : null}
      {submission.fileUrl ? (
        <TouchableOpacity
          style={st.fileRow}
          onPress={() => openFile(submission.fileUrl!)}
        >
          <Ionicons
            name="document-attach-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={st.fileText} numberOfLines={1}>
            Open attachment: {submission.fileName ?? "file"}
          </Text>
        </TouchableOpacity>
      ) : null}

      {rubric.length ? (
        <View style={st.rubric}>
          <Text style={st.rubricTitle}>Rubric scores</Text>
          {rubric.map(item => {
            const raw = scores[item.criterion] ?? "";
            const over =
              raw !== "" &&
              (Number(raw) > item.maxPoints ||
                Number(raw) < 0 ||
                !Number.isFinite(Number(raw)));
            return (
              <View key={item.criterion} style={st.criterionRow}>
                <Text style={st.criterion} numberOfLines={2}>
                  {item.criterion}{" "}
                  <Text style={st.criterionMax}>/ {item.maxPoints}</Text>
                </Text>
                <TextInput
                  style={[st.scoreInput, over && st.scoreInputError]}
                  value={raw}
                  onChangeText={value => {
                    clear("mark");
                    setScores(current => ({
                      ...current,
                      [item.criterion]: value,
                    }));
                  }}
                  keyboardType="numeric"
                  maxLength={6}
                  placeholder="0"
                  placeholderTextColor={colors.textLight}
                  accessibilityLabel={`${item.criterion} score out of ${item.maxPoints}`}
                />
              </View>
            );
          })}
          <Text style={st.total}>
            Total: {total} / {maxTotal}
          </Text>
          <FieldError message={errors.mark} />
        </View>
      ) : (
        <View style={st.markField}>
          <FormField
            label="Mark"
            value={grade}
            onChangeText={v => {
              setGrade(v);
              clear("mark");
            }}
            placeholder="e.g. 78"
            keyboardType="numeric"
            maxLength={6}
            error={errors.mark}
          />
        </View>
      )}

      <FormField
        label="Written feedback"
        value={feedback}
        onChangeText={v => {
          setFeedback(v);
          clear("feedback");
        }}
        placeholder="Explain strengths and next steps…"
        multiline
        maxLength={FEEDBACK_MAX}
        error={errors.feedback}
      />
      <PrimaryButton
        label="Save & notify student"
        icon="send-outline"
        loading={mutation.isPending}
        onPress={submit}
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  metaText: { flexShrink: 1, ...design.caption },
  email: { marginTop: 8, ...design.caption },
  noteBox: { padding: 12, marginTop: 12, ...design.card },
  noteLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  noteText: {
    fontSize: 14,
    color: colors.textSub,
    marginTop: 4,
    lineHeight: 20,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.primaryMuted,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  fileText: { flex: 1, color: colors.primary, fontWeight: "700", fontSize: 14 },
  rubric: { padding: 14, marginTop: 14, marginBottom: 12, ...design.card },
  rubricTitle: {
    textTransform: "uppercase",
    marginBottom: 8,
    ...design.cardTitle,
  },
  criterionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  criterion: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  criterionMax: { color: colors.textLight, fontWeight: "600" },
  scoreInput: { width: 76, textAlign: "center", ...design.input },
  scoreInputError: { borderColor: colors.error },
  markField: { marginTop: 14 },
  total: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 10,
  },
});
