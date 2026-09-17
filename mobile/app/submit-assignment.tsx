/**
 * Submit Assignment Screen
 * Route: /submit-assignment?assignmentId=<id>&courseId=<id>&title=<string>&description=<string>&dueDate=<ms>
 *
 * Students can:
 *  - Write a text note
 *  - Optionally attach a file (PDF/DOCX/PPTX/TXT)
 *  - Re-submit if they already submitted (updates the existing row)
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
  Linking,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { trpc, API_URL, getToken } from "../src/lib/api";
import { colors } from "../src/theme/colors";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function generateKey(fileName: string) {
  const ext = fileName.split(".").pop() ?? "bin";
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}.${ext}`;
}

type PickedFile = { name: string; uri: string; mimeType: string; size: number };

export default function SubmitAssignmentScreen() {
  const { assignmentId, courseId, title, description, dueDate, fileUrl, fileName } =
    useLocalSearchParams<{
      assignmentId: string;
      courseId: string;
      title: string;
      description?: string;
      dueDate?: string;
      fileUrl?: string;
      fileName?: string;
    }>();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const utils = trpc.useUtils();

  // Load existing submission
  const { data: existing } = trpc.assignments.mySubmission.useQuery({
    assignmentId: Number(assignmentId),
  });

  useEffect(() => {
    if (existing?.note) setNote(existing.note);
  }, [existing?.note]);

  const submitMutation = trpc.assignments.submit.useMutation({
    onSuccess: () => {
      utils.assignments.mySubmission.invalidate({ assignmentId: Number(assignmentId) });
      utils.assignments.mySubmissionsForCourse.invalidate({ courseId: Number(courseId) });
      Alert.alert(
        existing ? "Resubmitted!" : "Submitted!",
        "Your assignment has been submitted successfully.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: (err) => {
      setUploading(false);
      Alert.alert("Submission failed", err.message);
    },
  });

  const animateTo = (pct: number) => {
    setUploadPct(pct);
    Animated.timing(progressAnim, {
      toValue: pct / 100,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
             "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 50 * 1024 * 1024) {
      Alert.alert("File too large", "Max 50 MB allowed.");
      return;
    }
    setFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType ?? "application/octet-stream", size: asset.size ?? 0 });
  };

  const handleSubmit = async () => {
    if (!note.trim() && !file) {
      Alert.alert("Nothing to submit", "Add a note or attach a file.");
      return;
    }

    setUploading(true);
    animateTo(10);

    let fileUrl: string | undefined;
    let fileKey: string | undefined;
    let fileName: string | undefined;
    let fileSize: number | undefined;
    let mimeType: string | undefined;

    if (file) {
      try {
        animateTo(20);
        const key = `submissions/${generateKey(file.name)}`;
        const token = await getToken();
        if (!token) throw new Error("Please sign in again before uploading.");
        const uploadResult = await FileSystem.uploadAsync(
          `${API_URL}/api/storage/put?key=${encodeURIComponent(key)}`,
          file.uri,
          {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              "Content-Type": file.mimeType,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        animateTo(70);
        if (uploadResult.status < 200 || uploadResult.status >= 300) throw new Error("Upload failed");
        const body = JSON.parse(uploadResult.body) as { url: string; key: string };
        fileUrl = body.url;
        fileKey = body.key;
        fileName = file.name;
        fileSize = file.size;
        mimeType = file.mimeType;
        animateTo(85);
      } catch (err: any) {
        setUploading(false);
        animateTo(0);
        Alert.alert("Upload failed", err?.message ?? "Could not upload the file.");
        return;
      }
    }

    animateTo(95);
    submitMutation.mutate({
      assignmentId: Number(assignmentId),
      courseId: Number(courseId),
      note: note.trim() || undefined,
      fileUrl, fileKey, fileName, fileSize, mimeType,
    });
  };

  const dueDateMs = dueDate ? Number(dueDate) : null;
  const isLate = dueDateMs ? Date.now() > dueDateMs : false;

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} disabled={uploading}>
          <Ionicons name="arrow-back" size={22} color={uploading ? colors.textLight : colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Submit Assignment</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Assignment info */}
        <View style={s.infoCard}>
          <Text style={s.assignTitle}>{title}</Text>
          {description ? <Text style={s.assignDesc}>{description}</Text> : null}
          {fileUrl ? (
            <TouchableOpacity
              onPress={() => {
                const url = fileUrl.startsWith("http") ? fileUrl : `${API_URL}${fileUrl}`;
                void Linking.openURL(url);
              }}
              style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                {fileName || "Open assignment document"}
              </Text>
            </TouchableOpacity>
          ) : null}
          {dueDateMs ? (
            <View style={[s.dueBadge, isLate && s.dueBadgeLate]}>
              <Ionicons name="calendar-outline" size={13} color={isLate ? "#ef4444" : colors.primary} />
              <Text style={[s.dueText, isLate && { color: "#ef4444" }]}>
                {isLate ? "Overdue · " : "Due · "}
                {new Date(dueDateMs).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </Text>
            </View>
          ) : null}
          {existing && (
            <View style={s.existingBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={s.existingText}>
                Already submitted{existing.status === "graded" ? ` · Grade: ${existing.grade}` : ""}
              </Text>
            </View>
          )}
        </View>

        {/* Note field */}
        <View style={s.field}>
          <Text style={s.label}>Note / Answer</Text>
          <TextInput
            style={s.textarea}
            value={note}
            onChangeText={setNote}
            placeholder="Write your answer, comments, or notes here..."
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            editable={!uploading}
            maxLength={3000}
          />
          <Text style={s.charCount}>{note.length}/3000</Text>
        </View>

        {/* File attachment */}
        <View style={s.field}>
          <Text style={s.label}>Attachment (optional)</Text>
          {file ? (
            <View style={s.fileRow}>
              <View style={s.fileIcon}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={s.fileMeta}>{formatBytes(file.size)}</Text>
              </View>
              {!uploading && (
                <TouchableOpacity onPress={() => setFile(null)} style={s.removeBtn}>
                  <Ionicons name="close-circle" size={20} color={colors.textLight} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity style={s.pickBtn} onPress={pickFile} disabled={uploading} activeOpacity={0.8}>
              <Ionicons name="attach" size={20} color={colors.primary} />
              <Text style={s.pickBtnText}>Attach PDF, DOCX, PPTX or TXT</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AI info */}
        <View style={s.aiBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={s.aiBannerText}>
            Your lecturer will receive this submission and can leave feedback or a grade.
          </Text>
        </View>

        {/* Progress bar */}
        {uploading && (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <Animated.View style={[s.progressFill, { width: progressWidth as any }]} />
            </View>
            <Text style={s.progressLabel}>{uploadPct < 85 ? "Uploading file…" : "Saving submission…"} {uploadPct}%</Text>
          </View>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[s.submitBtn, uploading && s.submitBtnOff]}
          disabled={uploading || submitMutation.isPending}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          {uploading || submitMutation.isPending ? (
            <View style={s.btnInner}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={s.submitBtnText}>Submitting…</Text>
            </View>
          ) : (
            <View style={s.btnInner}>
              <Ionicons name="send" size={18} color={colors.white} />
              <Text style={s.submitBtnText}>{existing ? "Resubmit" : "Submit Assignment"}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Feedback if graded */}
        {existing?.status === "graded" && (existing.feedback || existing.grade || existing.rubricScores?.length) && (
          <View style={s.feedbackCard}>
            <Text style={s.feedbackTitle}>Lecturer Feedback</Text>
            {existing.feedback ? <Text style={s.feedbackText}>{existing.feedback}</Text> : null}
            {existing.grade ? <Text style={s.gradeText}>Grade: {existing.grade}</Text> : null}
            {existing.rubricScores?.length ? (
              <View style={s.rubricList}>
                <Text style={s.rubricTitle}>Rubric breakdown</Text>
                {existing.rubricScores.map((item) => (
                  <View key={item.criterion} style={s.rubricRow}>
                    <Text style={s.rubricCriterion}>{item.criterion}</Text>
                    <Text style={s.rubricScore}>{item.score}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  infoCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginBottom: 20, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  assignTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  assignDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  dueBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  dueBadgeLate: { backgroundColor: "#fee2e2" },
  dueText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  existingBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#e8fdf2", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  existingText: { fontSize: 12, fontWeight: "600", color: colors.primaryDark },

  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSub, marginBottom: 8 },
  textarea: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, minHeight: 120 },
  charCount: { fontSize: 11, color: colors.textLight, textAlign: "right", marginTop: 4 },

  pickBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primaryMuted, borderStyle: "dashed", paddingHorizontal: 16, paddingVertical: 14 },
  pickBtnText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primaryMuted, padding: 14 },
  fileIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  fileName: { fontSize: 14, fontWeight: "600", color: colors.text },
  fileMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  removeBtn: { padding: 4 },

  aiBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#e8fdf2", borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.primaryMuted },
  aiBannerText: { flex: 1, fontSize: 12, color: "#065f46", lineHeight: 18 },

  progressWrap: { marginBottom: 14, gap: 6 },
  progressBg: { height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 3 },
  progressLabel: { fontSize: 12, color: colors.textMuted },

  submitBtn: { backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 16, alignItems: "center", shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  submitBtnOff: { opacity: 0.5 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitBtnText: { fontSize: 16, fontWeight: "800", color: colors.white },

  feedbackCard: { marginTop: 20, backgroundColor: "#eff6ff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#bfdbfe", gap: 6 },
  feedbackTitle: { fontSize: 14, fontWeight: "700", color: "#1e40af" },
  feedbackText: { fontSize: 13, color: "#1e3a8a", lineHeight: 19 },
  gradeText: { fontSize: 14, fontWeight: "800", color: "#1e40af" },
  rubricList: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#bfdbfe", paddingTop: 8, gap: 6 },
  rubricTitle: { fontSize: 12, fontWeight: "700", color: "#1e40af" },
  rubricRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rubricCriterion: { flex: 1, fontSize: 12, color: "#1e3a8a" },
  rubricScore: { fontSize: 12, fontWeight: "800", color: "#1e40af" },
});
