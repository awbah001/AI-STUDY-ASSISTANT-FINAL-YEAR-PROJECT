import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

type Filter = "All" | "PDF" | "PPT" | "DOC";
const FILTERS: Filter[] = ["All", "PDF", "PPT", "DOC"];

function mimeToFilter(mime?: string | null): Filter {
  if (!mime) return "All";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PPT";
  if (mime.includes("word") || mime.includes("document")) return "DOC";
  return "All";
}

function docColor(f: Filter) {
  if (f === "PDF") return "#ef4444";
  if (f === "PPT") return "#f59e0b";
  if (f === "DOC") return "#3b82f6";
  return "#ef4444";
}
function docBg(f: Filter) {
  if (f === "PDF") return "#fef2f2";
  if (f === "PPT") return "#fffbeb";
  if (f === "DOC") return "#eff6ff";
  return "#fef2f2";
}
function docIcon(f: Filter) {
  if (f === "PPT") return "easel-outline";
  if (f === "DOC") return "document-outline";
  return "document-text-outline";
}

function timeAgo(date: string | Date) {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}

export default function LibraryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [refreshing, setRefreshing] = useState(false);

  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery();

  const filtered = (documents ?? []).filter((doc) => {
    const matchSearch = doc.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "All" || mimeToFilter(doc.mimeType) === filter;
    return matchSearch && matchFilter;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>Documents</Text>
        <TouchableOpacity style={s.sortBtn}>
          <Ionicons name="options-outline" size={20} color={colors.textSub} />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={s.searchWrap}>
        <Ionicons
          name="search-outline"
          size={17}
          color={colors.textLight}
          style={{ marginLeft: 14 }}
        />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search documents..."
          placeholderTextColor={colors.textLight}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} style={{ marginRight: 12 }}>
            <Ionicons name="close-circle" size={17} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter pills ── */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              s.filterPill,
              filter === f
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : {},
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[s.filterPillText, filter === f && { color: colors.white }]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── List ── */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="documents-outline" size={36} color={colors.primary} />
              </View>
              <Text style={s.emptyTitle}>No documents found</Text>
              <Text style={s.emptyText}>
                {search
                  ? "Try a different search term."
                  : "Documents shared by your lecturers appear here."}
              </Text>
            </View>
          }
          renderItem={({ item: doc }) => {
            const ft = mimeToFilter(doc.mimeType);
            const col = docColor(ft);
            const bg = docBg(ft);
            const ic = docIcon(ft);
            const sizeMB = (doc.fileSize / (1024 * 1024)).toFixed(1);
            const ago = timeAgo(doc.createdAt);
            return (
              <TouchableOpacity
                style={s.row}
                onPress={() =>
                  router.push({ pathname: "/document/[id]", params: { id: doc.id } })
                }
                activeOpacity={0.75}
              >
                {/* icon */}
                <View style={[s.rowIcon, { backgroundColor: bg }]}>
                  <Ionicons name={ic as any} size={22} color={col} />
                </View>

                {/* info */}
                <View style={s.rowInfo}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={s.rowMeta}>
                    {sizeMB} MB · {ago}
                  </Text>
                </View>

                {/* star */}
                <TouchableOpacity style={s.starBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons
                    name={doc.isFavorite ? "star" : "star-outline"}
                    size={18}
                    color={doc.isFavorite ? "#f59e0b" : colors.textLight}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push("/upload-document" as any)}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  sortBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
  },

  // Filter pills
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },

  // List
  list: { paddingHorizontal: 20, paddingBottom: 100 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  rowIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  starBtn: { paddingLeft: 4 },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#e8fdf2",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 240,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
});
