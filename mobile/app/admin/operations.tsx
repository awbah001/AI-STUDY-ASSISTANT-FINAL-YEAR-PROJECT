import { design } from "../../src/theme/design";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { resolveFileUrl } from "../../src/lib/uploadFile";
import { colors } from "../../src/theme/colors";
import { BackHeader } from "../../src/components/BackHeader";
import {
  Badge,
  Card,
  ChipSelect,
  EmptyState,
  Loading,
  SectionHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";
import {
  ActionRow,
  DetailRow,
  FilterLabel,
  formatBytes,
  formatDateTime,
  InlineButton,
  MetricGrid,
  MetricTile,
  Pager,
  ReasonForm,
  SearchBox,
  Sheet,
  timeAgo,
  useScreenFocused,
} from "../../src/components/staff/admin/AdminKit";

type StatusFilter = "all" | "failed" | "pending" | "processing" | "ready";
type DocStatus = Exclude<StatusFilter, "all">;
type DocMode = "detail" | "retry" | "public" | "flag" | "delete";

type AdminDoc = {
  id: number;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isPublic: boolean;
  processingStatus: DocStatus;
  processingError: string | null;
  reportCount: number;
  createdAt: Date;
  ownerId: number | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

const PAGE_SIZE = 20;
const STATUS_TONE: Record<DocStatus, "green" | "red" | "amber" | "blue"> = {
  ready: "green",
  failed: "red",
  pending: "amber",
  processing: "blue",
};

export default function AdminOperations() {
  const utils = trpc.useUtils();
  const focused = useScreenFocused();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<StatusFilter>("failed");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [doc, setDoc] = useState<AdminDoc | null>(null);
  const [mode, setMode] = useState<DocMode>("detail");
  const [showAllErrors, setShowAllErrors] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setSelected(new Set()), [status, page, debounced]);

  const overview = trpc.admin.getOperationsOverview.useQuery(undefined, {
    refetchInterval: focused ? 15_000 : false,
  });
  const docs = trpc.admin.listDocuments.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debounced,
    status: status === "all" ? undefined : status,
  });

  const items = (docs.data?.items ?? []) as AdminDoc[];
  const failedOnPage = items.filter(d => d.processingStatus === "failed");
  const allSelected =
    failedOnPage.length > 0 && failedOnPage.every(d => selected.has(d.id));
  const jobs = overview.data?.jobs;
  const errors = overview.data?.recentErrors ?? [];

  const refresh = () =>
    Promise.all([
      utils.admin.getOperationsOverview.invalidate(),
      utils.admin.listDocuments.invalidate(),
      utils.admin.getDashboardMetrics.invalidate(),
    ]);
  const fail = (err: { message: string }) =>
    Alert.alert("Action failed", err.message);
  const done = (title: string, body: string) => {
    void refresh();
    setDoc(null);
    Alert.alert(title, body);
  };

  const retry = trpc.admin.retryDocumentProcessing.useMutation({
    onError: fail,
  });
  const togglePublic = trpc.admin.toggleDocumentPublic.useMutation({
    onSuccess: updated =>
      done(
        updated?.isPublic ? "Document published" : "Document unpublished",
        `${updated?.title ?? "The document"} is now ${updated?.isPublic ? "public" : "private"}.`
      ),
    onError: fail,
  });
  const flag = trpc.admin.reportDocument.useMutation({
    onSuccess: () =>
      done(
        "Document flagged",
        "The moderation note was saved and the report count increased."
      ),
    onError: fail,
  });
  const remove = trpc.admin.deleteDocument.useMutation({
    onSuccess: () =>
      done(
        "Document deleted",
        "The document and its processing data were removed."
      ),
    onError: fail,
  });

  const toggleOne = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const retrySelected = async (reason: string) => {
    setBulkRunning(true);
    let ok = 0;
    const failures: string[] = [];
    for (const documentId of selected) {
      try {
        await retry.mutateAsync({ documentId, reason });
        ok += 1;
      } catch (err) {
        failures.push(err instanceof Error ? err.message : "Unknown error");
      }
    }
    setBulkRunning(false);
    setBulkOpen(false);
    setSelected(new Set());
    void refresh();
    Alert.alert(
      "Retry queued",
      failures.length
        ? `${ok} queued, ${failures.length} failed: ${failures[0]}`
        : `${ok} processing job${ok === 1 ? "" : "s"} queued.`
    );
  };

  const openDoc = (d: AdminDoc) => {
    setMode("detail");
    setDoc(d);
  };

  const docTitles: Record<DocMode, string> = {
    detail: doc?.title ?? "Document",
    retry: "Retry processing",
    public: doc?.isPublic ? "Make private" : "Make public",
    flag: "Flag document",
    delete: "Delete document",
  };
  const docHints: Record<DocMode, string | null> = {
    detail: null,
    retry:
      "Creates a tracked processing job and preserves the original failure in the audit log.",
    public: doc?.isPublic
      ? "The document will no longer be visible to other users."
      : "The document will become visible to other users.",
    flag: "Adds a moderation note and increases the report count on this document.",
    delete:
      "Permanently removes the document, its chunks and generated study material.",
  };

  return (
    <StaffScreen
      onRefresh={() => Promise.all([overview.refetch(), docs.refetch()])}
    >
      <BackHeader
        title="Operations"
        subtitle="Processing queue, storage and failures"
        fallback="/admin/more"
      />

      <View style={st.live}>
        <View style={st.liveDot} />
        <Text style={st.liveText}>Auto-refreshes every 15 seconds</Text>
      </View>

      {overview.error ? (
        <EmptyState icon="alert-circle-outline" text={overview.error.message} />
      ) : (
        <MetricGrid>
          <MetricTile
            icon="time-outline"
            label="Queued jobs"
            value={overview.isLoading ? "—" : (jobs?.pending ?? 0)}
            hint="Waiting to be processed"
            accent="#d97706"
            accentBg={colors.warningSoft}
            onPress={() => {
              setStatus("pending");
              setPage(1);
            }}
          />
          <MetricTile
            icon="checkmark-circle-outline"
            label="Completed jobs"
            value={overview.isLoading ? "—" : (jobs?.ready ?? 0)}
            hint="Successfully processed"
            accent={colors.success}
            accentBg={colors.primaryLight}
            onPress={() => {
              setStatus("ready");
              setPage(1);
            }}
          />
          <MetricTile
            icon="alert-circle-outline"
            label="Failed jobs"
            value={overview.isLoading ? "—" : (jobs?.failed ?? 0)}
            hint="Require attention"
            accent="#e11d48"
            accentBg={colors.errorSoft}
            onPress={() => {
              setStatus("failed");
              setPage(1);
            }}
          />
          <MetricTile
            icon="server-outline"
            label="Storage used"
            value={
              overview.isLoading
                ? "—"
                : formatBytes(overview.data?.storageBytes)
            }
            hint="Platform storage"
            accent="#0284c7"
            accentBg={colors.infoSoft}
          />
        </MetricGrid>
      )}

      <SectionHeader title="Documents" />
      <SearchBox
        value={search}
        onChangeText={setSearch}
        placeholder="Search title or owner"
      />
      <FilterLabel>Processing status</FilterLabel>
      <ChipSelect<StatusFilter>
        value={status}
        onChange={value => {
          setStatus(value);
          setPage(1);
        }}
        options={[
          { value: "failed", label: "Failed" },
          { value: "pending", label: "Pending" },
          { value: "processing", label: "Processing" },
          { value: "ready", label: "Ready" },
          { value: "all", label: "All" },
        ]}
      />

      {failedOnPage.length > 0 && (
        <View style={st.bulkBar}>
          <TouchableOpacity
            style={st.checkRow}
            onPress={() =>
              setSelected(
                allSelected ? new Set() : new Set(failedOnPage.map(d => d.id))
              )
            }
          >
            <Ionicons
              name={allSelected ? "checkbox" : "square-outline"}
              size={20}
              color={colors.primary}
            />
            <Text style={st.checkText}>
              {selected.size
                ? `${selected.size} selected`
                : "Select all failed"}
            </Text>
          </TouchableOpacity>
          <InlineButton
            label="Retry selected"
            icon="refresh"
            disabled={!selected.size || bulkRunning}
            onPress={() => setBulkOpen(true)}
          />
        </View>
      )}

      {docs.isLoading ? (
        <Loading />
      ) : docs.error ? (
        <EmptyState icon="alert-circle-outline" text={docs.error.message} />
      ) : !items.length ? (
        <EmptyState
          icon="document-text-outline"
          text={
            status === "failed" && !debounced
              ? "No failed processing jobs. All documents are being processed successfully."
              : "No documents match these filters."
          }
        />
      ) : (
        items.map(d => {
          const isFailed = d.processingStatus === "failed";
          const checked = selected.has(d.id);
          return (
            <Card key={d.id} onPress={() => openDoc(d)} style={st.docCard}>
              {isFailed ? (
                <TouchableOpacity
                  onPress={() => toggleOne(d.id)}
                  hitSlop={10}
                  accessibilityLabel={`Select ${d.title}`}
                  style={st.docCheck}
                >
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={22}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    st.docIcon,
                    {
                      backgroundColor:
                        d.processingStatus === "ready" ? "#e8fdf2" : "#fff7ed",
                    },
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={
                      d.processingStatus === "ready"
                        ? colors.success
                        : "#d97706"
                    }
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={st.docTitle} numberOfLines={2}>
                  {d.title}
                </Text>
                <Text style={st.meta} numberOfLines={1}>
                  {d.ownerName ?? d.ownerEmail ?? "Unknown owner"} ·{" "}
                  {formatBytes(d.fileSize)} · {formatDateTime(d.createdAt)}
                </Text>
                {isFailed ? (
                  <Text style={st.docError} numberOfLines={2}>
                    {d.processingError || "Unknown failure"}
                  </Text>
                ) : null}
                <View style={st.badges}>
                  <Badge
                    label={d.processingStatus}
                    tone={STATUS_TONE[d.processingStatus]}
                  />
                  {d.isPublic ? <Badge label="Public" tone="blue" /> : null}
                  {d.reportCount > 0 ? (
                    <Badge
                      label={`${d.reportCount} report${d.reportCount === 1 ? "" : "s"}`}
                      tone="amber"
                    />
                  ) : null}
                </View>
              </View>
              {isFailed ? (
                <TouchableOpacity
                  onPress={() => {
                    setMode("retry");
                    setDoc(d);
                  }}
                  hitSlop={8}
                  accessibilityLabel={`Retry ${d.title}`}
                  style={st.retryBtn}
                >
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </Card>
          );
        })
      )}

      {!!docs.data && (
        <Pager
          page={page}
          pageSize={PAGE_SIZE}
          total={docs.data.total}
          onChange={setPage}
        />
      )}

      <View style={{ height: 18 }} />
      <SectionHeader
        title={`Recent platform errors${errors.length ? ` (${errors.length})` : ""}`}
        action={
          errors.length > 5
            ? showAllErrors
              ? "Show less"
              : "Show all"
            : undefined
        }
        onAction={() => setShowAllErrors(v => !v)}
      />
      {overview.isLoading ? (
        <Loading />
      ) : !errors.length ? (
        <EmptyState
          icon="checkmark-done-outline"
          text="No recent system errors."
        />
      ) : (
        <Card>
          {(showAllErrors ? errors : errors.slice(0, 5)).map((event, index) => (
            <View
              key={event.id}
              style={[st.errorRow, index > 0 && st.errorBorder]}
            >
              <Ionicons
                name="warning-outline"
                size={16}
                color="#d97706"
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={st.errorText} selectable>
                  <Text style={{ fontWeight: "800" }}>{event.category}: </Text>
                  {event.message}
                </Text>
                <Text style={st.meta}>
                  {formatDateTime(event.createdAt)} · {timeAgo(event.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Sheet
        visible={bulkOpen}
        title={`Retry ${selected.size} job${selected.size === 1 ? "" : "s"}`}
        hint="Each selected document gets a tracked processing job. The reason is saved to the audit log."
        onClose={() => !bulkRunning && setBulkOpen(false)}
        cancelLabel="Cancel"
      >
        <ReasonForm
          confirmLabel="Retry selected"
          loading={bulkRunning}
          resetKey={bulkOpen}
          initialReason="Retry after transient failure"
          onSubmit={reason => void retrySelected(reason)}
        />
      </Sheet>

      <Sheet
        visible={!!doc}
        title={docTitles[mode]}
        hint={docHints[mode]}
        onClose={() => setDoc(null)}
      >
        {doc && mode === "detail" ? (
          <>
            <View style={st.badges}>
              <Badge
                label={doc.processingStatus}
                tone={STATUS_TONE[doc.processingStatus]}
              />
              <Badge
                label={doc.isPublic ? "Public" : "Private"}
                tone={doc.isPublic ? "blue" : "grey"}
              />
              {doc.reportCount > 0 ? (
                <Badge label={`${doc.reportCount} reports`} tone="amber" />
              ) : null}
            </View>
            <DetailRow label="File" value={doc.fileName} />
            <DetailRow label="Type" value={doc.mimeType} />
            <DetailRow label="Size" value={formatBytes(doc.fileSize)} />
            <DetailRow
              label="Owner"
              value={
                doc.ownerName
                  ? `${doc.ownerName}${doc.ownerEmail ? `\n${doc.ownerEmail}` : ""}`
                  : (doc.ownerEmail ?? "—")
              }
            />
            <DetailRow label="Uploaded" value={formatDateTime(doc.createdAt)} />
            {doc.processingError ? (
              <DetailRow
                label="Failure"
                value={doc.processingError}
                tone="danger"
              />
            ) : null}
            <View style={{ marginTop: 10 }}>
              <ActionRow
                icon="open-outline"
                label="Open file"
                hint="View the original upload"
                onPress={() =>
                  Linking.openURL(resolveFileUrl(doc.fileUrl)).catch(() =>
                    Alert.alert(
                      "Cannot open file",
                      "No app is available to open this file."
                    )
                  )
                }
              />
              <ActionRow
                icon="refresh-outline"
                label="Retry processing"
                hint="Re-extract text and rebuild the search index"
                onPress={() => setMode("retry")}
              />
              <ActionRow
                icon={doc.isPublic ? "lock-closed-outline" : "globe-outline"}
                label={doc.isPublic ? "Make private" : "Make public"}
                hint="Change who can see this document"
                onPress={() => setMode("public")}
              />
              <ActionRow
                icon="flag-outline"
                label="Flag document"
                hint="Record a moderation note"
                onPress={() => setMode("flag")}
              />
              <ActionRow
                icon="trash-outline"
                label="Delete document"
                hint="Permanent — requires a reason"
                danger
                onPress={() => setMode("delete")}
              />
            </View>
          </>
        ) : null}

        {doc && mode !== "detail" ? (
          <>
            <TouchableOpacity style={st.back} onPress={() => setMode("detail")}>
              <Ionicons name="arrow-back" size={16} color={colors.primary} />
              <Text style={st.backText}>{doc.title}</Text>
            </TouchableOpacity>
            {mode === "retry" ? (
              <ReasonForm
                confirmLabel="Queue retry"
                loading={retry.isPending}
                resetKey={`${doc.id}-retry`}
                onSubmit={reason =>
                  retry.mutate(
                    { documentId: doc.id, reason },
                    {
                      onSuccess: () =>
                        done(
                          "Retry queued",
                          `${doc.title} is being processed again.`
                        ),
                    }
                  )
                }
              />
            ) : mode === "public" ? (
              <ReasonForm
                confirmLabel={doc.isPublic ? "Make private" : "Make public"}
                loading={togglePublic.isPending}
                resetKey={`${doc.id}-public`}
                onSubmit={reason =>
                  togglePublic.mutate({ documentId: doc.id, reason })
                }
              />
            ) : mode === "flag" ? (
              <ReasonForm
                confirmLabel="Flag document"
                variant="danger"
                loading={flag.isPending}
                resetKey={`${doc.id}-flag`}
                placeholder="What is wrong with this document?"
                onSubmit={reason => flag.mutate({ documentId: doc.id, reason })}
              />
            ) : (
              <ReasonForm
                confirmLabel="Delete permanently"
                variant="danger"
                loading={remove.isPending}
                resetKey={`${doc.id}-delete`}
                onSubmit={reason =>
                  Alert.alert(
                    "Delete document?",
                    `Delete "${doc.title}"? This is permanent.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          remove.mutate({ documentId: doc.id, reason }),
                      },
                    ]
                  )
                }
              />
            )}
          </>
        ) : null}
      </Sheet>
    </StaffScreen>
  );
}

const st = StyleSheet.create({
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -8,
    marginBottom: 14,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { fontSize: 13, fontWeight: "700", color: colors.textSub },
  docCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    ...design.card,
  },
  docCheck: { paddingTop: 2 },
  docIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  docTitle: { ...design.cardTitle },
  docError: { fontSize: 12, color: "#e11d48", marginTop: 4 },
  meta: { marginTop: 3, ...design.caption },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  retryBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  errorRow: { flexDirection: "row", gap: 10, paddingVertical: 10 },
  errorBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  errorText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  backText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.primary },
});
