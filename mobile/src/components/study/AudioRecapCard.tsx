import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system/legacy";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { API_URL, trpc } from "../../lib/api";
import { friendlyError } from "../../lib/friendlyError";
import { colors } from "../../theme/colors";
import { design, radius } from "../../theme/design";
import { ProgressBar } from "../ui/Kit";
import { formatBytesShort, formatCountdown, formatDuration } from "../../../../shared/studentFeatures";

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const RECAP_DIR = `${FileSystem.documentDirectory ?? ""}recaps/`;

function remoteUrl(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

function localPathFor(url: string) {
  return `${RECAP_DIR}${url.split("/").pop()}`;
}

/** Spoken revision of a document: streams or plays a saved copy, falls back to the device voice. */
export function AudioRecapCard({ documentId }: { documentId: number }) {
  const utils = trpc.useUtils();
  const query = trpc.audioRecap.get.useQuery({ documentId });
  const generate = trpc.audioRecap.generate.useMutation({
    onSuccess: () => {
      void query.refetch();
      void utils.summary.get.invalidate({ documentId });
    },
    onError: (error) => Alert.alert("Couldn't make the recap", friendlyError(error.message, "Please try again.")),
  });
  const recap = query.data?.recap;
  const [speed, setSpeed] = useState<number>(1);
  const [showScript, setShowScript] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    return () => {
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    if (!recap?.audioUrl || !FileSystem.documentDirectory) return;
    void FileSystem.getInfoAsync(localPathFor(recap.audioUrl))
      .then((info) => {
        if (!cancelled && info.exists) setLocalUri(info.uri);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [recap?.audioUrl]);

  useEffect(() => {
    if (!recap?.audioUrl) return;
    player.replace({ uri: localUri ?? remoteUrl(recap.audioUrl) });
  }, [recap?.audioUrl, localUri]);

  useEffect(() => {
    player.setPlaybackRate(speed);
  }, [speed, status.isLoaded]);

  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish]);

  const togglePlay = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  const speak = () => {
    if (!recap) return;
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(recap.script, {
      rate: speed,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const saveOffline = async () => {
    if (!recap?.audioUrl) return;
    setSaving(true);
    try {
      await FileSystem.makeDirectoryAsync(RECAP_DIR, { intermediates: true }).catch(() => undefined);
      const existing = await FileSystem.readDirectoryAsync(RECAP_DIR).catch(() => [] as string[]);
      const prefix = `recap-doc-${documentId}-`;
      await Promise.all(
        existing.filter((name) => name.startsWith(prefix)).map((name) => FileSystem.deleteAsync(`${RECAP_DIR}${name}`, { idempotent: true }))
      );
      const result = await FileSystem.downloadAsync(remoteUrl(recap.audioUrl), localPathFor(recap.audioUrl));
      if (result.status !== 200) throw new Error(`Download failed (${result.status})`);
      setLocalUri(result.uri);
    } catch (error) {
      Alert.alert("Couldn't save", friendlyError((error as Error).message, "Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  const removeOffline = async () => {
    if (!localUri) return;
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    setLocalUri(null);
  };

  const busy = generate.isPending || !!query.data?.generating;
  const duration = status.duration || recap?.durationSeconds || 0;
  const position = status.currentTime || 0;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.icon}>
          <Ionicons name="headset" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Audio recap</Text>
          <Text style={s.caption}>A short spoken revision for the bus, the gym or a walk.</Text>
        </View>
      </View>

      {query.isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {query.data && !recap ? (
        <TouchableOpacity style={[s.primary, busy && { opacity: 0.75 }]} disabled={busy} onPress={() => generate.mutate({ documentId })}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Ionicons name="mic" size={17} color={colors.white} />}
          <Text style={s.primaryText}>
            {busy ? "Recording your recap..." : query.data.hasSummary ? "Create audio recap" : "Summarise and create recap"}
          </Text>
        </TouchableOpacity>
      ) : null}

      {recap ? (
        <View style={{ gap: 12 }}>
          {recap.stale ? (
            <Text style={s.warning}>The summary changed after this recap was made. Update it to hear the latest version.</Text>
          ) : null}

          {recap.audioUrl ? (
            <View style={s.player}>
              <TouchableOpacity
                style={s.playBtn}
                onPress={togglePlay}
                disabled={!status.isLoaded}
                accessibilityLabel={status.playing ? "Pause recap" : "Play recap"}
              >
                {!status.isLoaded ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Ionicons name={status.playing ? "pause" : "play"} size={24} color={colors.white} />
                )}
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 6 }}>
                <ProgressBar value={duration ? (position / duration) * 100 : 0} height={6} />
                <View style={s.timeRow}>
                  <Text style={s.caption}>{formatCountdown(position)}</Text>
                  <Text style={s.caption}>{formatCountdown(duration)}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => void player.seekTo(Math.max(0, position - 10))} accessibilityLabel="Back 10 seconds" hitSlop={8}>
                <Ionicons name="play-back" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.primary} onPress={speak}>
              <Ionicons name={speaking ? "stop" : "play"} size={17} color={colors.white} />
              <Text style={s.primaryText}>{speaking ? "Stop" : `Listen (about ${formatDuration(recap.durationSeconds)})`}</Text>
            </TouchableOpacity>
          )}

          <View style={s.chips}>
            {SPEEDS.map((value) => (
              <TouchableOpacity
                key={value}
                style={[s.chip, speed === value && s.chipOn]}
                onPress={() => {
                  setSpeed(value);
                  if (speaking) {
                    void Speech.stop();
                    setSpeaking(false);
                  }
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: speed === value }}
              >
                <Text style={[s.chipText, speed === value && s.chipTextOn]}>{value}×</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.actions}>
            {recap.audioUrl ? (
              localUri ? (
                <TouchableOpacity style={s.link} onPress={removeOffline}>
                  <Ionicons name="checkmark-done" size={15} color={colors.success} />
                  <Text style={[s.linkText, { color: colors.success }]}>Saved offline · remove</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.link} onPress={saveOffline} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="download-outline" size={15} color={colors.primary} />}
                  <Text style={s.linkText}>Save offline · {formatBytesShort(recap.audioBytes)}</Text>
                </TouchableOpacity>
              )
            ) : null}
            <TouchableOpacity style={s.link} onPress={() => setShowScript((v) => !v)}>
              <Ionicons name="document-text-outline" size={15} color={colors.primary} />
              <Text style={s.linkText}>{showScript ? "Hide transcript" : "Transcript"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => generate.mutate({ documentId })} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh" size={15} color={colors.primary} />}
              <Text style={s.linkText}>{recap.stale ? "Update" : "Remake"}</Text>
            </TouchableOpacity>
          </View>
          {!recap.audioUrl ? <Text style={s.caption}>Read aloud by your phone's voice.</Text> : null}
          {showScript ? <Text style={s.script}>{recap.script}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...design.card, padding: 16, gap: 14, marginBottom: 16 },
  head: { flexDirection: "row", gap: 12, alignItems: "center" },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...design.cardTitle, fontSize: 16 },
  caption: { ...design.caption },
  warning: { fontSize: 13, color: "#92400e", backgroundColor: colors.warningSoft, padding: 10, borderRadius: radius.sm },
  primary: { ...design.action, flexDirection: "row", gap: 8, minHeight: 48 },
  primaryText: { ...design.actionText, fontSize: 14 },
  player: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  chips: { flexDirection: "row", gap: 8 },
  chip: { ...design.chip, minHeight: 32, paddingVertical: 5, paddingHorizontal: 12 },
  chipOn: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textSub },
  chipTextOn: { color: colors.white, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  linkText: { fontSize: 12.5, fontWeight: "700", color: colors.primary },
  script: { ...design.body, backgroundColor: colors.surfaceAlt, padding: 12, borderRadius: radius.md },
});
