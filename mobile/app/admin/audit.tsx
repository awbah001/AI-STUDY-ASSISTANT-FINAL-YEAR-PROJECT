import { design } from "../../src/theme/design";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { BackHeader } from "../../src/components/BackHeader";
import {
  Card,
  ChipSelect,
  EmptyState,
  Loading,
  SectionHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";
import {
  DetailRow,
  FilterLabel,
  formatDateTime,
  InlineButton,
  SearchBox,
  Sheet,
  timeAgo,
} from "../../src/components/staff/admin/AdminKit";
import {
  shareText,
  toCsv,
} from "../../src/components/staff/lecturer-workspace/helpers";
import { monoFont } from "../../src/components/staff/admin/SettingsKit";

type TimePreset = "all" | "24h" | "7d" | "30d";
type IconName = keyof typeof Ionicons.glyphMap;

type AuditLog = {
  id: number;
  action: string;
  targetType: string;
  targetId: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  adminId: number;
  adminName: string | null;
};

const PAGE_LIMIT = 100;

export default function AdminAudit() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState("all");
  const [adminId, setAdminId] = useState<number | "all">("all");
  const [preset, setPreset] = useState<TimePreset>("all");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const range = useMemo(() => rangeFromPreset(preset), [preset]);

  const logs = trpc.admin.listAuditLogs.useQuery({
    search: debounced,
    action: action === "all" ? undefined : action,
    adminId: adminId === "all" ? undefined : adminId,
    from: range.from,
    to: range.to,
    limit: PAGE_LIMIT,
  });
  const catalog = trpc.admin.listAuditLogs.useQuery({ search: "", limit: 200 });
  const admins = trpc.admin.listUsers.useQuery({
    page: 1,
    pageSize: 50,
    search: "",
    role: "admin",
  });

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const log of catalog.data ?? []) set.add(log.action);
    return [...set].sort();
  }, [catalog.data]);

  const items = (logs.data ?? []) as AuditLog[];
  const filtered =
    debounced || action !== "all" || adminId !== "all" || preset !== "all";

  const reset = () => {
    setSearch("");
    setAction("all");
    setAdminId("all");
    setPreset("all");
  };

  const exportCsv = () => {
    if (!items.length) return;
    void shareText(
      "AI Learning Assistant audit log",
      toCsv([
        ["When", "Administrator", "Action", "Target", "Reason", "IP Address"],
        ...items.map(log => [
          new Date(log.createdAt).toLocaleString(),
          log.adminName ?? `Admin #${log.adminId}`,
          log.action,
          formatTarget(log),
          log.reason ?? "",
          ipFromMetadata(log.metadata),
        ]),
      ])
    );
  };

  return (
    <StaffScreen
      onRefresh={() => Promise.all([logs.refetch(), catalog.refetch()])}
    >
      <BackHeader
        title="Audit log"
        subtitle="Every privileged action on the platform"
        fallback="/admin/more"
      />

      <SearchBox
        value={search}
        onChangeText={setSearch}
        placeholder="Search actions, admins or reasons"
      />
      <FilterLabel>Time</FilterLabel>
      <ChipSelect<TimePreset>
        value={preset}
        onChange={setPreset}
        options={[
          { value: "all", label: "All time" },
          { value: "24h", label: "Last 24 hours" },
          { value: "7d", label: "Last 7 days" },
          { value: "30d", label: "Last 30 days" },
        ]}
      />
      <FilterLabel>Administrator</FilterLabel>
      <ChipSelect<number | "all">
        value={adminId}
        onChange={setAdminId}
        options={[
          { value: "all", label: "All admins" },
          ...(admins.data?.items ?? []).map(a => ({
            value: a.id,
            label: a.name ?? `Admin #${a.id}`,
          })),
        ]}
      />
      <FilterLabel>Action</FilterLabel>
      <ChipSelect<string>
        value={action}
        onChange={setAction}
        options={[
          { value: "all", label: "All actions" },
          ...actionOptions.map(a => ({ value: a, label: a })),
        ]}
      />

      <View style={st.toolbar}>
        <Text style={st.count}>
          {logs.isLoading
            ? "Loading…"
            : `${items.length}${items.length === PAGE_LIMIT ? "+" : ""} record${items.length === 1 ? "" : "s"}`}
        </Text>
        <View style={st.toolbarActions}>
          {filtered ? (
            <InlineButton label="Reset" icon="refresh" onPress={reset} />
          ) : null}
          <InlineButton
            label="Export CSV"
            icon="download-outline"
            disabled={!items.length}
            onPress={exportCsv}
          />
        </View>
      </View>

      <SectionHeader title="Audit records" />
      {logs.isLoading ? (
        <Loading />
      ) : logs.error ? (
        <EmptyState icon="alert-circle-outline" text={logs.error.message} />
      ) : !items.length ? (
        <EmptyState
          icon="shield-checkmark-outline"
          text={
            filtered
              ? "No audit records match these filters."
              : "No administrative actions have been recorded yet."
          }
        />
      ) : (
        items.map(log => {
          const tone = actionTone(log.action);
          return (
            <Card key={log.id} onPress={() => setSelected(log)} style={st.row}>
              <View style={[st.icon, { backgroundColor: tone.bg }]}>
                <Ionicons name={tone.icon} size={18} color={tone.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.action, { color: tone.fg }]} numberOfLines={1}>
                  {log.action}
                </Text>
                <Text style={st.target} numberOfLines={1}>
                  {formatTarget(log)}
                </Text>
                <Text style={st.meta} numberOfLines={1}>
                  {log.adminName ?? `Admin #${log.adminId}`} ·{" "}
                  {timeAgo(log.createdAt)}
                </Text>
                {log.reason ? (
                  <Text style={st.reason} numberOfLines={2}>
                    “{log.reason}”
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textLight}
              />
            </Card>
          );
        })
      )}

      <Sheet
        visible={!!selected}
        title={selected?.action ?? "Audit record"}
        hint="Audit records are read-only and cannot be edited."
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <DetailRow
              label="When"
              value={formatDateTime(selected.createdAt)}
            />
            <DetailRow
              label="Administrator"
              value={selected.adminName ?? `Admin #${selected.adminId}`}
            />
            <DetailRow label="Target" value={formatTarget(selected)} />
            <DetailRow label="Reason" value={selected.reason || "—"} />
            <DetailRow
              label="IP address"
              value={ipFromMetadata(selected.metadata)}
            />
            <DetailRow label="Status" value="Success" />
            {selected.metadata && Object.keys(selected.metadata).length ? (
              <View style={st.metaBox}>
                <Text style={st.metaTitle}>Details</Text>
                <Text style={st.metaJson} selectable>
                  {JSON.stringify(selected.metadata, null, 2)}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </StaffScreen>
  );
}

function actionTone(action: string): {
  icon: IconName;
  bg: string;
  fg: string;
} {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("banned"))
    return { icon: "trash-outline", bg: "#f3f0ff", fg: "#6d28d9" };
  if (a.includes("announcement") || a.includes("sent"))
    return { icon: "megaphone-outline", bg: "#e0f2fe", fg: "#0369a1" };
  if (a.includes("course") || a.includes("created"))
    return { icon: "book-outline", bg: "#e8fdf2", fg: "#047857" };
  if (
    a.includes("updated") ||
    a.includes("role") ||
    a.includes("restored") ||
    a.includes("password")
  )
    return { icon: "person-circle-outline", bg: "#fff7ed", fg: "#b45309" };
  if (
    a.includes("setting") ||
    a.includes("backup") ||
    a.includes("system") ||
    a.includes("retention")
  )
    return { icon: "settings-outline", bg: "#fdf2f8", fg: "#be185d" };
  if (a.includes("user"))
    return { icon: "person-outline", bg: "#fff7ed", fg: "#b45309" };
  return { icon: "checkmark-circle-outline", bg: "#f1f5f9", fg: "#475569" };
}

function formatTarget(
  log: Pick<AuditLog, "targetType" | "targetId" | "metadata">
) {
  const { metadata } = log;
  if (metadata && typeof metadata.code === "string") return metadata.code;
  if (metadata && typeof metadata.title === "string") return metadata.title;
  if (!log.targetId) return log.targetType;
  return `${log.targetType} #${log.targetId}`;
}

function ipFromMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return "—";
  const ip = metadata.ip ?? metadata.ipAddress ?? metadata.clientIp;
  return typeof ip === "string" && ip.trim() ? ip : "—";
}

function rangeFromPreset(preset: TimePreset): { from?: Date; to?: Date } {
  if (preset === "all") return {};
  const to = new Date();
  const from = new Date(to);
  if (preset === "24h") from.setHours(from.getHours() - 24);
  if (preset === "7d") from.setDate(from.getDate() - 7);
  if (preset === "30d") from.setDate(from.getDate() - 30);
  return { from, to };
}

const st = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 4,
    gap: 8,
  },
  toolbarActions: { flexDirection: "row", gap: 8 },
  count: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  action: { ...design.cardTitle },
  target: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 2 },
  meta: { marginTop: 2, ...design.caption },
  reason: { fontStyle: "italic", marginTop: 4, ...design.body },
  metaBox: { marginTop: 12, padding: 12, ...design.card },
  metaTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 6,
  },
  metaJson: { fontSize: 12, color: colors.text, fontFamily: monoFont },
});
