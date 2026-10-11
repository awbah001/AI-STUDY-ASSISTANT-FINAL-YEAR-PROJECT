import { design } from "../../../theme/design";
import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../../lib/api";
import { colors } from "../../../theme/colors";
import { Card, ChipSelect, Loading, PrimaryButton } from "../StaffUi";
import {
  INSIGHT_PERIODS,
  type ConfusionTopic,
  type InsightPeriod,
} from "../../../../../shared/lecturerInsights";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function TopicCard({ topic, rank, max }: { topic: ConfusionTopic; rank: number; max: number }) {
  const st = useStaffStyles(baseStyles);
  const [open, setOpen] = useState(false);
  return (
    <View style={st.topic}>
      <View style={st.topicHead}>
        <View style={st.rank}>
          <Text style={st.rankText}>{rank}</Text>
        </View>
        <Text style={st.topicTitle}>{topic.topic}</Text>
      </View>
      <Text style={st.muted}>
        {topic.questionCount} question{topic.questionCount === 1 ? "" : "s"} · {topic.studentCount} student
        {topic.studentCount === 1 ? "" : "s"}
      </Text>
      <View style={st.track}>
        <View style={[st.fill, { width: `${Math.max(8, (topic.questionCount / max) * 100)}%` }]} />
      </View>
      {topic.summary ? <Text style={st.body}>{topic.summary}</Text> : null}
      {topic.suggestion ? (
        <View style={st.suggestion}>
          <Ionicons name="bulb-outline" size={15} color="#b45309" />
          <Text style={st.suggestionText}>{topic.suggestion}</Text>
        </View>
      ) : null}
      {topic.examples.length ? (
        <>
          <TouchableOpacity style={st.toggle} onPress={() => setOpen(v => !v)} hitSlop={6}>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
            <Text style={st.toggleText}>Example questions</Text>
          </TouchableOpacity>
          {open
            ? topic.examples.map(example => (
                <Text key={example} style={st.example}>
                  “{example}”
                </Text>
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

/** "What's confusing my class": recent student questions grouped into topics, without names. */
export function ConfusionReport({ courseId }: { courseId: number }) {
  const st = useStaffStyles(baseStyles);
  const [days, setDays] = useState<InsightPeriod>(7);
  const utils = trpc.useUtils();
  const report = trpc.lecturer.ai.confusionReport.useQuery({ courseId });
  const generate = trpc.lecturer.ai.generateConfusionReport.useMutation({
    onSuccess: data => utils.lecturer.ai.confusionReport.setData({ courseId }, data),
    onError: err => Alert.alert("Couldn't build the report", err.message),
  });
  const data = report.data;
  const stale = data ? Date.now() - new Date(data.createdAt).getTime() > WEEK_MS : false;
  const max = Math.max(1, ...(data?.topics ?? []).map(t => t.questionCount));

  return (
    <Card>
      <Text style={st.caption}>Topics students ask the AI and the discussion board about most</Text>
      <ChipSelect<number>
        value={days}
        onChange={value => setDays(value as InsightPeriod)}
        options={INSIGHT_PERIODS.map(value => ({ value, label: `Last ${value} days` }))}
      />
      <PrimaryButton
        label={generate.isPending ? "Analysing…" : data ? "Refresh report" : "Build report"}
        icon="refresh"
        variant="outline"
        loading={generate.isPending}
        onPress={() => generate.mutate({ courseId, days })}
      />
      <View style={st.content}>
        {report.isLoading ? (
          <Loading />
        ) : !data ? (
          <Text style={st.body}>
            No report yet. Build one to see which topics your students are asking about most, so you know what to go
            over again.
          </Text>
        ) : (
          <>
            <Text style={st.muted}>
              {data.questionCount} question{data.questionCount === 1 ? "" : "s"} from {data.studentCount} student
              {data.studentCount === 1 ? "" : "s"} · {new Date(data.periodStart).toLocaleDateString()} to{" "}
              {new Date(data.periodEnd).toLocaleDateString()}
            </Text>
            {stale ? <Text style={st.stale}>Over a week old. Refresh for the latest.</Text> : null}
            {data.topics.length ? (
              data.topics.map((topic, index) => (
                <TopicCard key={topic.topic} topic={topic} rank={index + 1} max={max} />
              ))
            ) : (
              <Text style={st.empty}>
                {data.questionCount < 3
                  ? "Not enough questions in this period yet. Try a longer period, or check back once students have used the AI more."
                  : "No clear pattern in this period's questions."}
              </Text>
            )}
          </>
        )}
      </View>
      <View style={st.privacy}>
        <Ionicons name="shield-checkmark-outline" size={13} color={colors.textLight} />
        <Text style={st.privacyText}>
          Anonymised: names are never shown or sent to the AI, and emails and phone numbers are removed from questions.
        </Text>
      </View>
    </Card>
  );
}

const baseStyles = StyleSheet.create({
  caption: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  content: { marginTop: 14, gap: 10 },
  muted: { ...design.caption },
  body: { ...design.body, fontSize: 13.5 },
  stale: { fontSize: 12.5, fontWeight: "700", color: "#b45309" },
  topic: { ...design.card, padding: 12, gap: 6 },
  topicHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  topicTitle: { flex: 1, ...design.cardTitle },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.borderLight, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
  suggestion: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: colors.warningSoft,
    borderRadius: 10,
    padding: 10,
  },
  suggestionText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 19 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  toggleText: { fontSize: 12.5, fontWeight: "700", color: colors.primary },
  example: {
    fontSize: 12.5,
    fontStyle: "italic",
    color: colors.textSub,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
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
  privacy: { flexDirection: "row", gap: 6, marginTop: 14, alignItems: "flex-start" },
  privacyText: { flex: 1, fontSize: 11.5, color: colors.textLight, lineHeight: 16 },
});
