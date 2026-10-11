import { design } from "../../../theme/design";
import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../../lib/api";
import { colors } from "../../../theme/colors";
import type { GradeDraft } from "../../../../../shared/lecturerInsights";

type DraftResult = { draft: GradeDraft; draftedAt: Date | string | null };

/** Suggests marks and feedback. It only fills the form; the lecturer still saves. */
export function AiGradeAssist({
  submissionId,
  existing,
  onApply,
}: {
  submissionId: number;
  existing?: { draft: GradeDraft | null; draftedAt: Date | string | null };
  onApply: (draft: GradeDraft) => void;
}) {
  const st = useStaffStyles(baseStyles);
  const utils = trpc.useUtils();
  const [result, setResult] = useState<DraftResult | null>(
    existing?.draft ? { draft: existing.draft, draftedAt: existing.draftedAt } : null
  );
  const [showReasons, setShowReasons] = useState(false);
  const draft = trpc.lecturer.ai.draftGrade.useMutation({
    onSuccess: data => {
      setResult(data);
      setShowReasons(true);
      onApply(data.draft);
      void utils.lecturer.assignments.reviewQueue.invalidate();
    },
    onError: err => Alert.alert("Couldn't draft a grade", err.message),
  });

  return (
    <View style={st.box}>
      <View style={st.head}>
        <Ionicons name="sparkles" size={16} color={colors.violet} />
        <Text style={st.title}>{result ? "AI suggestion" : "Let the AI suggest marks"}</Text>
      </View>
      {result ? (
        <>
          <Text style={st.caption}>
            Suggested {result.draft.total} / {result.draft.maxTotal}
            {result.draftedAt ? ` · ${new Date(result.draftedAt).toLocaleString()}` : ""}. You decide the final
            mark.
          </Text>
          {result.draft.warning ? (
            <View style={st.warning}>
              <Ionicons name="warning-outline" size={14} color="#b45309" />
              <Text style={st.warningText}>{result.draft.warning}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={() => setShowReasons(v => !v)} style={st.toggle} hitSlop={6}>
            <Ionicons name={showReasons ? "chevron-up" : "chevron-down"} size={14} color={colors.violet} />
            <Text style={st.toggleText}>Why these marks</Text>
          </TouchableOpacity>
          {showReasons
            ? result.draft.criteria.map(c => (
                <View key={c.criterion} style={st.reason}>
                  <Text style={st.reasonTitle}>
                    {c.criterion}: {c.score} / {c.maxPoints}
                  </Text>
                  {c.comment ? <Text style={st.reasonText}>{c.comment}</Text> : null}
                </View>
              ))
            : null}
        </>
      ) : !draft.isPending ? (
        <Text style={st.caption}>
          The AI reads the submission, the brief and your course notes, then fills in scores and feedback for you to
          check and edit.
        </Text>
      ) : null}
      <View style={st.actions}>
        {result ? (
          <TouchableOpacity style={st.outline} onPress={() => onApply(result.draft)}>
            <Text style={st.outlineText}>Use suggestion</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[st.solid, draft.isPending && { opacity: 0.6 }]}
          disabled={draft.isPending}
          onPress={() => draft.mutate({ submissionId, regenerate: Boolean(result) })}
        >
          {draft.isPending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name={result ? "refresh" : "sparkles"} size={14} color={colors.white} />
          )}
          <Text style={st.solidText}>
            {draft.isPending ? "Reading submission…" : result ? "Redo" : "Draft with AI"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  box: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ecc9d2",
    backgroundColor: colors.violetSoft,
    gap: 8,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 14, fontWeight: "800", color: colors.violet },
  caption: { ...design.caption },
  warning: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  warningText: { flex: 1, fontSize: 12.5, color: "#b45309", lineHeight: 18 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  toggleText: { fontSize: 12.5, fontWeight: "700", color: colors.violet },
  reason: { backgroundColor: colors.surface, borderRadius: 10, padding: 10 },
  reasonTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  reasonText: { fontSize: 12.5, color: colors.textSub, marginTop: 2, lineHeight: 18 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  outline: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ecc9d2",
    backgroundColor: colors.surface,
  },
  outlineText: { fontSize: 13, fontWeight: "700", color: colors.violet },
  solid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.violet,
  },
  solidText: { fontSize: 13, fontWeight: "700", color: colors.white },
});
