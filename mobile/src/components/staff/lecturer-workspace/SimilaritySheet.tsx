import { design } from "../../../theme/design";
import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { useEffect } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { trpc } from "../../../lib/api";
import { colors } from "../../../theme/colors";
import { Badge, Loading } from "../StaffUi";
import { BottomSheet } from "./Sheet";
import { SIMILARITY_LABEL, similarityLevel } from "../../../../../shared/lecturerInsights";

const LEVEL_TONE = { high: "red", medium: "amber", low: "grey" } as const;

function LevelBadge({ percent }: { percent: number }) {
  const st = useStaffStyles(baseStyles);
  const level = similarityLevel(percent);
  if (!level) return <Text style={st.muted}>{percent}%</Text>;
  return <Badge label={`${percent}% · ${SIMILARITY_LABEL[level]}`} tone={LEVEL_TONE[level]} />;
}

function Passages({ items }: { items: string[] }) {
  const st = useStaffStyles(baseStyles);
  return (
    <>
      {items.map((p, i) => (
        <Text key={i} style={st.passage}>
          “{p}”
        </Text>
      ))}
    </>
  );
}

/** Compares an assignment's submissions with each other and with the course notes. */
export function SimilaritySheet({
  assignment,
  onClose,
}: {
  assignment: { id: number; title: string } | null;
  onClose: () => void;
}) {
  const st = useStaffStyles(baseStyles);
  const check = trpc.lecturer.ai.similarity.useMutation({
    onError: err => Alert.alert("Couldn't run the check", err.message),
  });
  const { mutate, reset } = check;
  const assignmentId = assignment?.id ?? null;
  useEffect(() => {
    if (assignmentId) mutate({ assignmentId });
    else reset();
  }, [assignmentId, mutate, reset]);
  const data = check.data;

  return (
    <BottomSheet
      visible={!!assignment}
      onClose={onClose}
      title="Similarity check"
      subtitle={assignment?.title ?? null}
    >
      <Text style={st.caption}>
        Compares submissions word for word, ignoring text copied from the brief. Overlap is a reason to look closer,
        not proof of copying: shared quotes, references or group work can explain it.
      </Text>
      {check.isPending ? (
        <>
          <Loading />
          <Text style={[st.muted, { textAlign: "center" }]}>Reading and comparing submissions…</Text>
        </>
      ) : !data ? null : (
        <>
          <Text style={st.muted}>
            {data.submissions.length} submission{data.submissions.length === 1 ? "" : "s"} checked ·{" "}
            {new Date(data.checkedAt).toLocaleString()}
          </Text>

          <Text style={st.heading}>Between students</Text>
          {data.pairs.length ? (
            data.pairs.map(pair => (
              <View key={`${pair.a.submissionId}-${pair.b.submissionId}`} style={st.card}>
                <Text style={st.names}>
                  {pair.a.studentName} <Text style={st.muted}>and</Text> {pair.b.studentName}
                </Text>
                <View style={st.badgeRow}>
                  <LevelBadge percent={pair.percent} />
                </View>
                <Text style={st.muted}>
                  {pair.percent}% of the shorter submission appears word for word in the other.
                </Text>
                <Passages items={pair.passages} />
              </View>
            ))
          ) : (
            <Text style={st.empty}>No noticeable shared wording between submissions.</Text>
          )}

          <Text style={st.heading}>Copied from course notes</Text>
          {data.submissions.map(s => (
            <View key={s.submissionId} style={st.card}>
              <View style={st.rowBetween}>
                <Text style={[st.names, { flex: 1 }]} numberOfLines={1}>
                  {s.studentName}
                </Text>
                <Text style={st.muted}>{s.words.toLocaleString()} words</Text>
              </View>
              {s.comparable ? (
                <>
                  <View style={st.badgeRow}>
                    <LevelBadge percent={s.notesPercent} />
                  </View>
                  <Passages items={s.notesPassages} />
                </>
              ) : (
                <Text style={st.muted}>Too short or not readable (scan or photo)</Text>
              )}
            </View>
          ))}
        </>
      )}
    </BottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  caption: { ...design.caption, marginBottom: 10 },
  muted: { ...design.caption },
  heading: { ...design.cardTitle, marginTop: 14, marginBottom: 8 },
  card: { ...design.card, padding: 12, marginBottom: 8, gap: 6 },
  names: { fontSize: 14, fontWeight: "700", color: colors.text },
  badgeRow: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 8 },
  passage: {
    fontSize: 12.5,
    fontStyle: "italic",
    color: colors.textSub,
    lineHeight: 18,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  empty: {
    ...design.caption,
    padding: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 12,
  },
});
