import { design, elevation } from "../../src/theme/design";
import { LinearGradient } from "expo-linear-gradient";
import { EmptyCard, IconTile } from "../../src/components/ui/Kit";
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
import { colors, gradients } from "../../src/theme/colors";
import { DocumentProcessingStatus } from "../../src/components/study/DocumentProcessingStatus";

type Filter = "All" | "PDF" | "PPT" | "DOC";
const FILTERS: Filter[] = ["All", "PDF", "PPT", "DOC"];

function mimeToFilter(mime?: string | null): Filter {
  if (!mime) return "All";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return "PPT";
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

  const {
    data: documents,
    isLoading,
    refetch,
  } = trpc.documents.list.useQuery(undefined, { refetchInterval: query => query.state.data?.some(doc => ["pending", "processing"].includes(doc.processingStatus)) ? 2500 : false });

  const filtered = (documents ?? []).filter(doc => {
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
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>
            {documents?.length ?? 0} {documents?.length === 1 ? "document" : "documents"}
          </Text>
          <Text style={s.title}>Library</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/offline-study" as any)}><Text style={{ color: colors.primary }}>Downloads</Text></TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={s.searchWrap}>
        <Ionicons
          name="search-outline"
          size={18}
          color={colors.textLight}
          style={{ marginLeft: 14 }}
        />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search documents"
          placeholderTextColor={colors.textLight}
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch("")}
            style={{ paddingHorizontal: 12 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter pills ── */}
      <View style={s.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[s.filterPill, active && s.filterPillActive]}
              onPress={() => setFilter(f)}
            >
              {f !== "All" ? (
                <View style={[s.filterDot, { backgroundColor: active ? colors.white : docColor(f) }]} />
              ) : null}
              <Text style={[s.filterPillText, active && { color: colors.white }]}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── List ── */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={d => String(d.id)}
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
            <EmptyCard
              icon="documents-outline"
              title="No documents found"
              body={
                search
                  ? "Try a different search term."
                  : "Documents shared by your lecturers appear here."
              }
              action={search ? undefined : "Upload a document"}
              onAction={() => router.push("/upload-document" as any)}
            />
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
                  router.push({
                    pathname: "/document/[id]",
                    params: { id: doc.id },
                  })
                }
                activeOpacity={0.75}
              >
                <IconTile icon={ic as any} color={col} bg={bg} size={48} />

                <View style={s.rowInfo}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <DocumentProcessingStatus doc={doc} />
                  <View style={s.rowMetaLine}>
                    <View style={[s.typeTag, { backgroundColor: bg }]}>
                      <Text style={[s.typeTagText, { color: col }]}>
                        {ft === "All" ? "FILE" : ft}
                      </Text>
                    </View>
                    <Text style={s.rowMeta}>
                      {sizeMB} MB · {ago}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={s.starBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={doc.isFavorite ? "star" : "star-outline"}
                    size={17}
                    color={doc.isFavorite ? colors.warning : colors.textLight}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push("/upload-document" as any)}
        activeOpacity={0.9}
        accessibilityLabel="Upload a document"
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.fabInner}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={colors.white} />
          <Text style={s.fabText}>Upload</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, ...design.page },

  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  eyebrow: { ...design.eyebrow, color: colors.primary, marginBottom: 4 },
  title: { ...design.screenTitle },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    ...design.search,
  },
  searchInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 10,
    fontSize: 14.5,
    color: colors.text,
  },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterPill: { ...design.chip, flexDirection: "row", alignItems: "center", gap: 6 },
  filterPillActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterPillText: { fontSize: 13, fontWeight: "600", color: colors.textSub },

  list: { paddingHorizontal: 20, paddingBottom: 110 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
    gap: 14,
    ...design.card,
  },
  rowInfo: { flex: 1, gap: 5 },
  rowTitle: { ...design.cardTitle },
  rowMetaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeTagText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  rowMeta: { ...design.caption },
  starBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },

  fab: {
    position: "absolute",
    bottom: 22,
    right: 20,
    borderRadius: 28,
    ...elevation.brand,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 27,
  },
  fabText: { color: colors.white, fontWeight: "700", fontSize: 14.5 },
});
