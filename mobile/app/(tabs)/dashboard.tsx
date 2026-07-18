import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: documents, isLoading: docsLoading, refetch: refetchDocs } =
    trpc.documents.list.useQuery();
  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } =
    trpc.progress.stats.useQuery();

  const firstName = user?.name?.split(/\s+/)[0] ?? "there";
  const totalDocuments = documents?.length ?? 0;
  const totalFlashcards =
    progress?.reduce((s, p) => s + (p.flashcardsReviewed ?? 0), 0) ?? 0;
  const totalQuizzes =
    progress?.reduce((s, p) => s + (p.quizzesAttempted ?? 0), 0) ?? 0;
  const totalStudyMins =
    progress?.reduce((s, p) => s + (p.totalStudyTimeMinutes ?? 0), 0) ?? 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDocs(), refetchProgress()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back 👋</Text>
            <Text style={styles.name}>Hi, {firstName}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push("/profile")}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Documents"
            value={docsLoading ? null : totalDocuments}
            icon="document-text"
            accent={colors.primary}
          />
          <StatCard
            label="Flashcards"
            value={progressLoading ? null : totalFlashcards}
            icon="layers"
            accent="#3b82f6"
          />
          <StatCard
            label="Quizzes"
            value={progressLoading ? null : totalQuizzes}
            icon="help-circle"
            accent="#8b5cf6"
          />
          <StatCard
            label="Study time"
            value={
              progressLoading
                ? null
                : `${Math.floor(totalStudyMins / 60)}h ${totalStudyMins % 60}m`
            }
            icon="time"
            accent="#f59e0b"
          />
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actions}>
          <QuickAction
            icon="book"
            label="My Courses"
            accent={colors.primary}
            onPress={() => router.push("/(tabs)/courses")}
          />
          <QuickAction
            icon="layers"
            label="Flashcards"
            accent="#3b82f6"
            onPress={() => router.push("/(tabs)/flashcards")}
          />
          <QuickAction
            icon="document-text"
            label="Documents"
            accent="#8b5cf6"
            onPress={() => router.push("/(tabs)/documents")}
          />
          <QuickAction
            icon="trending-up"
            label="Progress"
            accent="#f59e0b"
            onPress={() => router.push("/(tabs)/progress")}
          />
        </View>

        {/* Recent documents */}
        <Text style={styles.sectionTitle}>Recent documents</Text>
        {docsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        ) : documents && documents.length > 0 ? (
          documents.slice(0, 5).map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.docItem}
              onPress={() =>
                router.push({ pathname: "/document/[id]", params: { id: doc.id } })
              }
              activeOpacity={0.7}
            >
              <View style={styles.docIconWrap}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docTitle} numberOfLines={1}>
                  {doc.title}
                </Text>
                <Text style={styles.docMeta}>
                  {new Date(doc.createdAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="cloud-upload-outline" size={36} color={colors.primaryLight} />
            <Text style={styles.emptyText}>No documents yet</Text>
            <Text style={styles.emptySubtext}>
              Your lecturer will share course materials here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string | null;
  icon: string;
  accent: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <View style={[styles.statIcon, { backgroundColor: accent + "20" }]}>
        <Ionicons name={icon as any} size={18} color={accent} />
      </View>
      {value === null ? (
        <ActivityIndicator size="small" color={accent} style={{ marginVertical: 4 }} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  accent,
  onPress,
}: {
  icon: string;
  label: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.qaIcon, { backgroundColor: accent + "15" }]}>
        <Ionicons name={icon as any} size={22} color={accent} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 20,
  },
  greeting: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  name: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  avatarBtn: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: colors.white },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderTopWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 14,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  quickAction: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  qaIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  qaLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  docItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  docMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: "600", color: colors.text },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
});
