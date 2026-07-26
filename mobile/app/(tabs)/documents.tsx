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

export default function DocumentsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery();

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
          <Text style={styles.pageTitle}>Documents</Text>
          <Text style={styles.pageSubtitle}>
            Your library of study materials.
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : !documents || documents.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="documents-outline" size={48} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No documents</Text>
              <Text style={styles.emptyText}>
                Documents shared by your lecturers will appear here.
              </Text>
            </View>
          ) : (
            documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                onPress={() =>
                  router.push({ pathname: "/document/[id]", params: { id: doc.id } })
                }
                activeOpacity={0.75}
              >
                <View style={styles.docIcon}>
                  <Ionicons
                    name={
                      doc.mimeType?.includes("pdf")
                        ? "document-text"
                        : "document"
                    }
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={2}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docMeta}>
                    {(doc.fileSize / 1024).toFixed(0)} KB ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </Text>
                </View>
                <View style={styles.docActions}>
                  {doc.isFavorite ? (
                    <Ionicons name="star" size={18} color="#f59e0b" />
                  ) : null}
                  <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                </View>
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
  pageSubtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6, marginBottom: 28 },
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
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: "600", color: colors.text, lineHeight: 22 },
  docMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  docActions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
});
