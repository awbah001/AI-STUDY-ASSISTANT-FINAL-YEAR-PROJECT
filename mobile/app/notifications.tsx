import { design, elevation } from "../src/theme/design";
/**
 * Notification Inbox Screen
 * Route: /notifications  (pushed from dashboard bell icon)
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { coachRoute } from "../src/lib/coachRoute";

function timeAgo(date: Date | string | number) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function notifIcon(data: Record<string, unknown> | null | undefined) {
  const type = data?.type as string | undefined;
  if (type === "ai_coach")
    return { icon: "sparkles", color: colors.violet, bg: colors.violetSoft };
  if (type === "announcement")
    return { icon: "megaphone", color: colors.violet, bg: colors.violetSoft };
  if (type === "quiz")
    return { icon: "help-circle", color: "#d97706", bg: colors.warningSoft };
  if (type === "material")
    return {
      icon: "document-text",
      color: colors.primary,
      bg: colors.primaryLight,
    };
  return {
    icon: "notifications",
    color: colors.primary,
    bg: colors.primaryLight,
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const utils = trpc.useUtils();

  const {
    data: notifs,
    isLoading,
    refetch,
  } = trpc.notifications.list.useQuery();

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const unreadCount = (notifs ?? []).filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={21} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Notifications</Text>
          <Text style={s.headerSub}>
            {isLoading
              ? "Loading…"
              : unreadCount > 0
                ? `${unreadCount} unread`
                : "You're all caught up"}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={s.markAllBtn}
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <Ionicons name="checkmark-done" size={15} color={colors.primary} />
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={notifs ?? []}
          keyExtractor={n => String(n.id)}
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
              <View style={s.emptyHalo}>
                <View style={s.emptyIcon}>
                  <Ionicons
                    name="notifications-outline"
                    size={32}
                    color={colors.primary}
                  />
                </View>
              </View>
              <Text style={s.emptyTitle}>All caught up</Text>
              <Text style={s.emptyText}>
                No notifications yet. Announcements from your lecturers will
                appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const { icon, color, bg } = notifIcon(item.data as any);
            return (
              <TouchableOpacity
                style={[s.row, !item.isRead && s.rowUnread]}
                onPress={() => {
                  if (!item.isRead)
                    markRead.mutate({ notificationId: item.id });
                  // Navigate based on notification type
                  const data = item.data as any;
                  const coach = coachRoute(data);
                  if (coach) {
                    router.push(coach);
                  } else if (data?.type === "announcement" && data?.courseId) {
                    router.push({
                      pathname: "/course/[id]",
                      params: { id: data.courseId },
                    });
                  }
                }}
                activeOpacity={0.8}
              >
                {!item.isRead && <View style={s.unreadStripe} />}

                <View style={[s.iconWrap, { backgroundColor: bg }]}>
                  <Ionicons name={icon as any} size={20} color={color} />
                </View>

                <View style={s.content}>
                  <View style={s.titleRow}>
                    <Text
                      style={[s.notifTitle, !item.isRead && s.notifTitleUnread]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={s.unreadDot} />}
                  </View>
                  <Text style={s.notifBody} numberOfLines={2}>
                    {item.body}
                  </Text>
                  <View style={s.timeRow}>
                    <Ionicons name="time-outline" size={12} color={colors.textLight} />
                    <Text style={s.notifTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, ...design.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: { ...design.iconButton, borderRadius: 22 },
  headerTitle: { ...design.screenTitle, fontSize: 22, lineHeight: 28 },
  headerSub: { ...design.caption, marginTop: 1 },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  markAllText: { fontSize: 12.5, color: colors.primary, fontWeight: "700" },
  list: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    marginBottom: 10,
    gap: 12,
    overflow: "hidden",
    ...design.card,
  },
  rowUnread: { borderWidth: 1, borderColor: colors.primaryMuted },
  unreadStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: { flex: 1 },
  notifTitle: { flex: 1, ...design.cardTitle },
  notifTitleUnread: { fontWeight: "800" },
  notifBody: { marginTop: 3, marginBottom: 8, ...design.body },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  notifTime: { fontWeight: "600", ...design.caption, fontSize: 11.5 },
  empty: { alignItems: "center", paddingTop: 72, gap: 12 },
  emptyHalo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.sm,
  },
  emptyTitle: { ...design.sectionTitle },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
});
