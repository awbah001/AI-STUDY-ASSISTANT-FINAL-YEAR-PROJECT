import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function FlashcardsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  // Flashcards are per-document. Show all documents that have flashcards.
  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery();
  const { data: progress } = trpc.progress.stats.useQuery();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.pageTitle}>Flashcards</Text>
          <Text style={styles.pageSubtitle}>Review cards from your documents.</Text>

          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                </View>
                <Text style={styles.summaryValue}>{totalReviewed}</Text>
                <Text style={styles.summaryLabel}>Reviewed</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIconWrap, { backgroundColor: "#eff6ff" }]}>
                  <Ionicons name="documents" size={24} color="#3b82f6" />
                </View>
                <Text style={styles.summaryValue}>{documents?.length ?? 0}</Text>
                <Text style={styles.summaryLabel}>Sources</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Pick a document to study</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : !documents || documents.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="layers-outline" size={48} color={colors.primary} />
              </View>
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
                  <Ionicons name="layers" size={24} color="#3b82f6" />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={2}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docMeta}>Tap to review flashcards</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 20 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.75 },
  pageSubtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6, marginBottom: 24 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  summaryItem: { alignItems: "center", gap: 6 },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  summaryValue: { fontSize: 26, fontWeight: "800", color: colors.text },
  summaryLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    alignSelf: "stretch",
  },
  sectionTitle: {
    fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 16,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 56,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  docIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: "600", color: colors.text, lineHeight: 22 },
  docMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
