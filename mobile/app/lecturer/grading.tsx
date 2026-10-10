import { useState } from "react";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import {
  Badge,
  ChipSelect,
  EmptyState,
  formatDate,
  ListItem,
  Loading,
  StaffHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";
import { GradeSubmissionSheet } from "../../src/components/staff/lecturer-workspace/GradeSubmissionSheet";
import {
  isLateSubmission,
  submissionStatus,
} from "../../src/components/staff/lecturer-workspace/helpers";

type Filter = "pending" | "graded" | "all";

export default function LecturerGrading() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queue = trpc.lecturer.assignments.reviewQueue.useQuery();

  const all = queue.data ?? [];
  const pendingCount = all.filter(item => item.status !== "graded").length;
  const items = all.filter(item =>
    filter === "all"
      ? true
      : filter === "graded"
        ? item.status === "graded"
        : item.status !== "graded"
  );
  const selected = all.find(item => item.id === selectedId) ?? null;

  return (
    <StaffScreen onRefresh={() => queue.refetch()}>
      <StaffHeader
        title="Grading"
        subtitle="Review student submissions and send feedback."
      />
      <ChipSelect<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "pending", label: `To grade (${pendingCount})` },
          { value: "graded", label: `Graded (${all.length - pendingCount})` },
          { value: "all", label: `All (${all.length})` },
        ]}
      />
      {queue.isLoading ? (
        <Loading />
      ) : queue.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          text="Unable to load submissions. Pull down to try again."
        />
      ) : !items.length ? (
        <EmptyState
          icon="checkmark-done-outline"
          text={
            filter === "pending"
              ? "No submissions waiting for a grade."
              : filter === "graded"
                ? "Nothing graded yet."
                : "No submissions yet."
          }
        />
      ) : (
        items.map(item => {
          const status = submissionStatus(item);
          const late = isLateSubmission(item) && item.status !== "graded";
          const hasRubric = !!item.rubric?.length;
          return (
            <ListItem
              key={item.id}
              icon={
                item.status === "graded"
                  ? "checkmark-circle"
                  : "document-attach"
              }
              iconBg={late ? "#fef2f2" : colors.primaryLight}
              iconColor={late ? colors.error : colors.primary}
              title={item.assignmentTitle}
              subtitle={item.studentName ?? item.studentEmail}
              meta={`Submitted ${formatDate(item.submittedAt)}${item.grade ? ` · Grade ${item.grade}` : ""}${hasRubric ? " · Rubric" : ""}`}
              right={<Badge label={status.label} tone={status.tone} />}
              onPress={() => setSelectedId(item.id)}
            />
          );
        })
      )}

      <GradeSubmissionSheet
        submission={selected}
        onClose={() => setSelectedId(null)}
      />
    </StaffScreen>
  );
}
