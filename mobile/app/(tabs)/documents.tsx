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

export default function DocumentsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery();

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.pageTitle}>Documents</Text>
        <Text style={styles.pageSubtitle}>
          Your library of study materials.
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : !documents || documents.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="documents-outline" size={48} color={colors.primaryLight} />
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
                  size={22}
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
                  <Ionicons name="star" size={16} color="#f59e0b" />
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
              </View>
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
  pageSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 24 },
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
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 20 },
  docMeta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  docActions: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 },
});
