import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { offlineStorage, setOfflineOwner } from "../../lib/offlineStudy";
import { getAuthSessionKey } from "../../lib/authSession";
import { colors } from "../../theme/colors";

export function OfflineDownloadButton({ documentId }: { documentId: number }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  if (user?.role !== "user") return null;
  const save = async () => {
    setSaving(true);
    try {
      const pack = await utils.client.offlineStudy.download.query({ documentId });
      if (getAuthSessionKey() !== `user-${pack.ownerId}`) return;
      await offlineStorage.save(user.id, pack);
      await setOfflineOwner(user.id);
      setSaved(true);
      Alert.alert("Saved for offline study", `Notes, ${pack.cards.length} flashcards, and ${pack.quizzes.length} practice quizzes are available in Downloads. Update this copy after generating more practice material.`);
    } catch (error) { Alert.alert("Download failed", error instanceof Error ? error.message : "Please try again."); }
    finally { setSaving(false); }
  };
  return <View style={{ flexDirection: "row", gap: 16, paddingVertical: 8 }}>
    <TouchableOpacity onPress={() => void save()} disabled={saving}><Text style={{ color: colors.primary }}>{saving ? "Saving…" : saved ? "Update offline copy" : "Save for offline study"}</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => router.push("/offline-study" as any)}><Text style={{ color: colors.primary }}>Downloads</Text></TouchableOpacity>
  </View>;
}
