import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function FlashcardsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  // Flashcards are per-document. Show all documents that have flashcards.
  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery();
  const { data: progress } = trpc.progress.stats.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const totalReviewed =
    progress?.reduce((s, p) => s + (p.flashcardsReviewed ?? 0), 0) ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.pageTitle}>Flashcards</Text>
        <Text style={styles.pageSubtitle}>Review cards from your documents.</Text>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <Text style={styles.summaryValue}>{totalReviewed}</Text>
              <Text style={styles.summaryLabel}>Reviewed</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="documents" size={22} color="#3b82f6" />
              <Text style={styles.summaryValue}>{documents?.length ?? 0}</Text>
              <Text style={styles.summaryLabel}>Sources</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Pick a document to study</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : !documents || documents.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="layers-outline" size={48} color={colors.primaryLight} />
            <Text style={styles.emptyTitle}>No flashcards yet</Text>
            <Text style={styles.emptyText}>
              Open a document and generate flashcards to start reviewing.
            </Text>
          </View>
        ) : (
          documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.docCard}
              onPress={() =>
                router.push({
                  pathname: "/document/[id]",
                  params: { id: doc.id, tab: "flashcards" },
                })
              }
              activeOpacity={0.75}
            >
              <View style={styles.docIcon}>
                <Ionicons name="layers" size={20} color="#3b82f6" />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docTitle} numberOfLines={1}>
                  {doc.title}
                </Text>
                <Text style={styles.docMeta}>Tap to review flashcards</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 20 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryItem: { alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    alignSelf: "stretch",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 14,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  docMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
