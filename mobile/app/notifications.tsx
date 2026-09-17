/**
 * Notification Inbox Screen
 * Route: /notifications  (pushed from dashboard bell icon)
 */

import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../src/lib/api";
import { colors } from "../src/theme/colors";

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
  if (type === "announcement") return { icon: "megaphone", color: "#8b5cf6", bg: "#f3f0ff" };
  if (type === "quiz") return { icon: "help-circle", color: "#f59e0b", bg: "#fffbeb" };
  if (type === "material") return { icon: "document-text", color: colors.primary, bg: colors.primaryLight };
  return { icon: "notifications", color: colors.primary, bg: colors.primaryLight };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const utils = trpc.useUtils();

  const { data: notifs, isLoading, refetch } = trpc.notifications.list.useQuery();

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

  const unreadCount = (notifs ?? []).filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            style={s.markAllBtn}
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={notifs ?? []}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={36} color={colors.primary} />
              </View>
              <Text style={s.emptyTitle}>All caught up!</Text>
              <Text style={s.emptyText}>No notifications yet. Announcements from your lecturers will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const { icon, color, bg } = notifIcon(item.data as any);
            return (
              <TouchableOpacity
                style={[s.row, !item.isRead && s.rowUnread]}
                onPress={() => {
                  if (!item.isRead) markRead.mutate({ notificationId: item.id });
                  // Navigate based on notification type
                  const data = item.data as any;
                  if (data?.type === "announcement" && data?.courseId) {
                    router.push({ pathname: "/course/[id]", params: { id: data.courseId } });
                  }
                }}
                activeOpacity={0.75}
              >
                {/* Unread dot */}
                {!item.isRead && <View style={s.unreadDot} />}

                {/* Icon */}
                <View style={[s.iconWrap, { backgroundColor: bg }]}>
                  <Ionicons name={icon as any} size={20} color={color} />
                </View>

                {/* Content */}
                <View style={s.content}>
                  <Text style={[s.notifTitle, !item.isRead && s.notifTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={s.notifBody} numberOfLines={2}>{item.body}</Text>
                  <Text style={s.notifTime}>{timeAgo(item.createdAt)}</Text>
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
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  markAllBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  markAllText: { fontSize: 13, color: colors.primary, fontWeight: "700" },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  row: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  rowUnread: { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: colors.primaryMuted },
  unreadDot: { position: "absolute", top: 14, left: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  content: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 2 },
  notifTitleUnread: { fontWeight: "800" },
  notifBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, color: colors.textLight, fontWeight: "500" },
  empty: { alignItems: "center", paddingTop: 64, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", maxWidth: 260, lineHeight: 20 },
});
