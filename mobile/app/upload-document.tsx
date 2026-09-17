/**
 * Upload Document Screen — lets students upload their own study materials.
 *
 * Route: /upload-document   (pushed from Library FAB)
 *
 * Flow:
 *   1. Student taps "Choose file" → expo-document-picker opens native file picker.
 *   2. File is read as base64 with expo-file-system.
 *   3. Raw bytes are PUT to   POST /api/storage/put?key=uploads/<uuid>.<ext>
 *      which returns { url, key }.
 *   4. trpc.documents.createOwn registers the document in the DB.
 *   5. Background text extraction + RAG indexing run server-side automatically.
 *   6. On success, navigate back to Library.
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useState, useRef } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { trpc, API_URL, getToken } from "../src/lib/api";
import { colors } from "../src/theme/colors";

// Allowed MIME types and their display labels / icons
const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "text/plain",
];

function mimeIcon(mime: string) {
  if (mime.includes("pdf")) return { icon: "document-text", color: "#ef4444", bg: "#fef2f2" };
  if (mime.includes("presentation") || mime.includes("powerpoint")) return { icon: "easel", color: "#f59e0b", bg: "#fffbeb" };
  if (mime.includes("word") || mime.includes("document")) return { icon: "document", color: "#3b82f6", bg: "#eff6ff" };
  return { icon: "document-text", color: colors.primary, bg: "#e8fdf2" };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateKey(fileName: string) {
  const ext = fileName.split(".").pop() ?? "bin";
  const uuid = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${uuid}.${ext}`;
}

type PickedFile = {
  name: string;
  uri: string;
  mimeType: string;
  size: number;
};

type UploadStage =
  | "idle"
  | "reading"    // reading bytes from disk
  | "uploading"  // PUT to /api/storage/put
  | "saving"     // trpc.documents.createOwn
  | "done";

export default function UploadDocumentScreen() {
  const router = useRouter();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<UploadStage>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const createOwn = trpc.documents.createOwn.useMutation({
    onSuccess: () => {
      setStage("done");
    },
    onError: (err) => {
      setStage("idle");
      Alert.alert("Save failed", err.message);
    },
  });

  // ── Step 1: Pick a file ───────────────────────────────────────────────────
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      // Guard: 50 MB limit (server has a 60 MB hard limit)
      if (asset.size && asset.size > 50 * 1024 * 1024) {
        Alert.alert("File too large", "Please choose a file smaller than 50 MB.");
        return;
      }

      setFile({
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: asset.size ?? 0,
      });

      // Pre-fill title from filename (strip extension)
      if (!title.trim()) {
        const nameWithoutExt = asset.name.replace(/\.[^.]+$/, "");
        setTitle(nameWithoutExt);
      }
    } catch {
      Alert.alert("Error", "Could not open the file picker.");
    }
  };

  // ── Step 2: Animate progress bar ─────────────────────────────────────────
  const animateTo = (pct: number, duration = 400) => {
    setUploadPct(pct);
    Animated.timing(progressAnim, {
      toValue: pct / 100,
      duration,
      useNativeDriver: false,
    }).start();
  };

  // ── Step 3: Upload + register ─────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return;
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a title for this document.");
      return;
    }

    try {
      // — Read file bytes as base64 —
      setStage("reading");
      animateTo(10);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      animateTo(30);

      // — PUT raw bytes to server storage endpoint —
      setStage("uploading");
      const key = generateKey(file.name);
      const uploadUrl = `${API_URL}/api/storage/put?key=${encodeURIComponent(key)}`;

      // Convert base64 → binary string for fetch
      // React Native fetch accepts base64 data URIs via XMLHttpRequest,
      // but expo-file-system.uploadAsync is the most reliable approach
      const token = await getToken();
      if (!token) {
        throw new Error("Please sign in again before uploading.");
      }
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, file.uri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          "Content-Type": file.mimeType,
          Authorization: `Bearer ${token}`,
        },
      });

      animateTo(70);

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }

      const uploadBody = JSON.parse(uploadResult.body) as { url: string; key: string };

      animateTo(85);

      // — Register document in DB via tRPC —
      setStage("saving");
      createOwn.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: uploadBody.url,
        fileKey: uploadBody.key,
        mimeType: file.mimeType,
      });

      animateTo(100, 600);
    } catch (err: any) {
      setStage("idle");
      animateTo(0, 200);
      Alert.alert(
        "Upload failed",
        err?.message ?? "Something went wrong. Check your connection and try again."
      );
    }
  };

  // ── Done screen ───────────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.doneWrap}>
          <View style={s.doneIcon}>
            <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
          </View>
          <Text style={s.doneTitle}>Upload complete!</Text>
          <Text style={s.doneSub}>
            Your document has been saved.{"\n"}
            The AI is indexing it in the background — chat and flashcard
            generation will be available shortly.
          </Text>
          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => router.replace("/(tabs)/library")}
          >
            <Text style={s.doneBtnText}>Go to Library</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.doneBtnSecondary}
            onPress={() => {
              setFile(null);
              setTitle("");
              setDescription("");
              setStage("idle");
              setUploadPct(0);
              progressAnim.setValue(0);
            }}
          >
            <Text style={s.doneBtnSecondaryText}>Upload another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isUploading = stage !== "idle";
  const { icon: fileIcon, color: fileColor, bg: fileBg } = file
    ? mimeIcon(file.mimeType)
    : { icon: "document", color: colors.textLight, bg: "#f1f5f9" };

  const stageLabel = {
    idle: "",
    reading: "Reading file…",
    uploading: "Uploading…",
    saving: "Saving document…",
    done: "",
  }[stage];

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} disabled={isUploading}>
          <Ionicons name="arrow-back" size={22} color={isUploading ? colors.textLight : colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Upload Document</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── File picker card ── */}
        <TouchableOpacity
          style={[s.pickCard, file && s.pickCardFilled]}
          onPress={isUploading ? undefined : pickFile}
          activeOpacity={0.8}
        >
          {file ? (
            <View style={s.filePreview}>
              <View style={[s.fileIconWrap, { backgroundColor: fileBg }]}>
                <Ionicons name={fileIcon as any} size={32} color={fileColor} />
              </View>
              <View style={s.fileInfo}>
                <Text style={s.fileName} numberOfLines={2}>{file.name}</Text>
                <Text style={s.fileMeta}>
                  {formatBytes(file.size)} ·{" "}
                  {file.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                </Text>
              </View>
              {!isUploading && (
                <TouchableOpacity
                  style={s.changeBtn}
                  onPress={pickFile}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.changeBtnText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={s.pickEmpty}>
              <View style={s.pickIconCircle}>
                <Ionicons name="cloud-upload-outline" size={36} color={colors.primary} />
              </View>
              <Text style={s.pickTitle}>Choose a document</Text>
              <Text style={s.pickSub}>PDF, DOCX, PPTX, TXT · Max 50 MB</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Form fields ── */}
        <View style={s.form}>
          <View style={s.field}>
            <Text style={s.label}>Title *</Text>
            <TextInput
              style={[s.input, isUploading && s.inputDisabled]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Data Structures Lecture 3"
              placeholderTextColor={colors.textLight}
              editable={!isUploading}
              maxLength={300}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Description (optional)</Text>
            <TextInput
              style={[s.input, s.inputMulti, isUploading && s.inputDisabled]}
              value={description}
              onChangeText={setDescription}
              placeholder="What is this document about?"
              placeholderTextColor={colors.textLight}
              editable={!isUploading}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* ── AI info banner ── */}
        <View style={s.aiBanner}>
          <View style={s.aiBannerIcon}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <Text style={s.aiBannerText}>
            After upload, Cognify AI will automatically extract the text
            and index it — enabling chat, flashcard generation, and quizzes.
          </Text>
        </View>

        {/* ── Progress bar (shown while uploading) ── */}
        {isUploading && (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <Animated.View style={[s.progressFill, { width: progressWidth as any }]} />
            </View>
            <View style={s.progressRow}>
              <Text style={s.progressLabel}>{stageLabel}</Text>
              <Text style={s.progressPct}>{uploadPct}%</Text>
            </View>
          </View>
        )}

        {/* ── Upload button ── */}
        <TouchableOpacity
          style={[
            s.uploadBtn,
            (!file || !title.trim() || isUploading) && s.uploadBtnDisabled,
          ]}
          disabled={!file || !title.trim() || isUploading}
          onPress={handleUpload}
          activeOpacity={0.85}
        >
          {isUploading ? (
            <View style={s.uploadBtnInner}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={s.uploadBtnText}>{stageLabel}</Text>
            </View>
          ) : (
            <View style={s.uploadBtnInner}>
              <Ionicons name="cloud-upload" size={20} color={colors.white} />
              <Text style={s.uploadBtnText}>Upload Document</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },

  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },

  // Pick card
  pickCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    overflow: "hidden",
    marginBottom: 20,
  },
  pickCardFilled: {
    borderStyle: "solid",
    borderColor: colors.primaryMuted,
  },
  pickEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 44,
    gap: 10,
  },
  pickIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e8fdf2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  pickTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  pickSub: { fontSize: 13, color: colors.textMuted },

  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  fileIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 20 },
  fileMeta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  changeBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeBtnText: { fontSize: 12, fontWeight: "700", color: colors.textSub },

  // Form
  form: { gap: 16, marginBottom: 16 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSub },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.text,
  },
  inputMulti: { minHeight: 88, paddingTop: 13 },
  inputDisabled: { opacity: 0.55 },

  // AI banner
  aiBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#e8fdf2",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  aiBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  aiBannerText: { flex: 1, fontSize: 13, color: "#065f46", lineHeight: 19 },

  // Progress
  progressWrap: { gap: 8, marginBottom: 16 },
  progressBg: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  progressPct: { fontSize: 12, color: colors.primary, fontWeight: "700" },

  // Upload button
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  uploadBtnDisabled: { opacity: 0.45 },
  uploadBtnInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  uploadBtnText: { fontSize: 16, fontWeight: "800", color: colors.white },

  // Done screen
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  doneIcon: {
    width: 100,
    height: 100,
    borderRadius: 32,
    backgroundColor: "#e8fdf2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  doneTitle: { fontSize: 26, fontWeight: "900", color: colors.text },
  doneSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 40,
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  doneBtnText: { fontSize: 16, fontWeight: "800", color: colors.white },
  doneBtnSecondary: { paddingVertical: 10 },
  doneBtnSecondaryText: { fontSize: 14, color: colors.primary, fontWeight: "700" },
});
