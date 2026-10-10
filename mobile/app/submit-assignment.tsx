import { design, elevation } from "../src/theme/design";
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
import * as FileSystem from "expo-file-system/legacy";
import { trpc, API_URL, getToken } from "../src/lib/api";
import { LIMITS, validateText } from "../src/lib/validation";
import { FieldError, FIELD_ERROR_COLOR } from "../src/components/FieldError";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients } from "../src/theme/colors";

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
  const {
    assignmentId,
    courseId,
    title,
    description,
    dueDate,
    fileUrl,
    fileName,
  } = useLocalSearchParams<{
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
  const [noteError, setNoteError] = useState<string | null>(null);
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
      utils.assignments.mySubmission.invalidate({
        assignmentId: Number(assignmentId),
      });
      utils.assignments.mySubmissionsForCourse.invalidate({
        courseId: Number(courseId),
      });
      Alert.alert(
        existing ? "Resubmitted!" : "Submitted!",
        "Your assignment has been submitted successfully.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: err => {
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
      type: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 50 * 1024 * 1024) {
      Alert.alert("File too large", "Max 50 MB allowed.");
      return;
    }
    setFile({
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size ?? 0,
    });
    setNoteError(null);
  };

  const handleSubmit = async () => {
    const error =
      !note.trim() && !file
        ? "Add a note or attach a file before submitting."
        : validateText(note, { label: "Note", required: false, max: LIMITS.description });
    setNoteError(error);
    if (error) return;

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
        if (uploadResult.status < 200 || uploadResult.status >= 300)
          throw new Error("Upload failed");
        const body = JSON.parse(uploadResult.body) as {
          url: string;
          key: string;
        };
        fileUrl = body.url;
        fileKey = body.key;
        fileName = file.name;
        fileSize = file.size;
        mimeType = file.mimeType;
        animateTo(85);
      } catch (err: any) {
        setUploading(false);
        animateTo(0);
        Alert.alert(
          "Upload failed",
          err?.message ?? "Could not upload the file."
        );
        return;
      }
    }

    animateTo(95);
    submitMutation.mutate({
      assignmentId: Number(assignmentId),
      courseId: Number(courseId),
      note: note.trim() || undefined,
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      mimeType,
    });
  };

  const dueDateMs = dueDate ? Number(dueDate) : null;
  const isLate = dueDateMs ? Date.now() > dueDateMs : false;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          disabled={uploading}
          accessibilityLabel="Go back"
        >
          <Ionicons
            name="chevron-back"
            size={21}
            color={uploading ? colors.textLight : colors.text}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {existing ? "Resubmit work" : "Submit work"}
          </Text>
          <Text style={s.headerSub}>Assignment submission</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.infoCard}>
          <View style={s.infoTop}>
            <View style={s.infoIcon}>
              <Ionicons name="clipboard" size={20} color={colors.primary} />
            </View>
            <Text style={s.infoEyebrow}>Assignment</Text>
          </View>
          <Text style={s.assignTitle}>{title}</Text>
          {description ? <Text style={s.assignDesc}>{description}</Text> : null}
          {fileUrl ? (
            <TouchableOpacity
              onPress={() => {
                const url = fileUrl.startsWith("http")
                  ? fileUrl
                  : `${API_URL}${fileUrl}`;
                void Linking.openURL(url);
              }}
              style={s.briefChip}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text" size={16} color={colors.primary} />
              <Text style={s.briefChipText} numberOfLines={1}>
                {fileName || "Open assignment document"}
              </Text>
              <Ionicons name="open-outline" size={14} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          <View style={s.badgeRow}>
            {dueDateMs ? (
              <View style={[s.dueBadge, isLate && s.dueBadgeLate]}>
                <Ionicons
                  name="calendar"
                  size={12}
                  color={isLate ? colors.error : colors.primary}
                />
                <Text style={[s.dueText, isLate && { color: colors.error }]}>
                  {isLate ? "Overdue · " : "Due · "}
                  {new Date(dueDateMs).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </Text>
              </View>
            ) : null}
            {existing && (
              <View style={s.existingBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={13}
                  color={colors.info}
                />
                <Text style={s.existingText}>
                  Submitted
                  {existing.status === "graded"
                    ? ` · Grade: ${existing.grade}`
                    : ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Note field */}
        <View style={s.field}>
          <Text style={s.label}>Your answer</Text>
          <TextInput
            style={[s.textarea, !!noteError && { borderColor: FIELD_ERROR_COLOR }]}
            value={note}
            onChangeText={v => {
              setNote(v);
              setNoteError(null);
            }}
            placeholder="Write your answer, comments, or notes here..."
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            editable={!uploading}
            maxLength={LIMITS.description}
            accessibilityLabel="Your answer"
          />
          <FieldError message={noteError} />
          <Text style={s.charCount}>{note.length}/{LIMITS.description}</Text>
        </View>

        {/* File attachment */}
        <View style={s.field}>
          <Text style={s.label}>Attachment (optional)</Text>
          {file ? (
            <View style={s.fileRow}>
              <View style={s.fileIcon}>
                <Ionicons
                  name="document-text"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={s.fileMeta}>{formatBytes(file.size)}</Text>
              </View>
              {!uploading && (
                <TouchableOpacity
                  onPress={() => setFile(null)}
                  style={s.removeBtn}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textLight}
                  />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={s.pickBtn}
              onPress={pickFile}
              disabled={uploading}
              activeOpacity={0.8}
            >
              <View style={s.pickIcon}>
                <Ionicons name="attach" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.pickBtnText}>Attach a file</Text>
                <Text style={s.pickBtnSub}>PDF, DOCX, PPTX or TXT · 50 MB</Text>
              </View>
              <Ionicons name="add-circle" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* AI info */}
        <View style={s.aiBanner}>
          <Ionicons name="information-circle" size={17} color={colors.primary} />
          <Text style={s.aiBannerText}>
            Your lecturer will receive this submission and can leave feedback or
            a grade.
          </Text>
        </View>

        {/* Progress bar */}
        {uploading && (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <Animated.View
                style={[s.progressFill, { width: progressWidth as any }]}
              />
            </View>
            <Text style={s.progressLabel}>
              {uploadPct < 85 ? "Uploading file…" : "Saving submission…"}{" "}
              {uploadPct}%
            </Text>
          </View>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[s.submitWrap, uploading && s.submitBtnOff]}
          disabled={uploading || submitMutation.isPending}
          onPress={handleSubmit}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.submitBtn}
          >
            {uploading || submitMutation.isPending ? (
              <View style={s.btnInner}>
                <ActivityIndicator color={colors.white} size="small" />
                <Text style={s.submitBtnText}>Submitting…</Text>
              </View>
            ) : (
              <View style={s.btnInner}>
                <Ionicons name="paper-plane" size={18} color={colors.white} />
                <Text style={s.submitBtnText}>
                  {existing ? "Resubmit" : "Submit assignment"}
                </Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {existing?.status === "graded" &&
          (existing.feedback ||
            existing.grade ||
            existing.rubricScores?.length) && (
            <View style={s.feedbackCard}>
              <View style={s.feedbackHead}>
                <View style={s.feedbackIcon}>
                  <Ionicons name="ribbon" size={18} color={colors.info} />
                </View>
                <Text style={s.feedbackTitle}>Lecturer feedback</Text>
              </View>
              {existing.feedback ? (
                <Text style={s.feedbackText}>{existing.feedback}</Text>
              ) : null}
              {existing.grade ? (
                <Text style={s.gradeText}>Grade: {existing.grade}</Text>
              ) : null}
              {existing.rubricScores?.length ? (
                <View style={s.rubricList}>
                  <Text style={s.rubricTitle}>Rubric breakdown</Text>
                  {existing.rubricScores.map(item => (
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
  safe: { flex: 1, ...design.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  backBtn: { ...design.iconButton, borderRadius: 22 },
  headerTitle: { ...design.screenTitle, fontSize: 22, lineHeight: 28 },
  headerSub: { ...design.caption, marginTop: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },

  infoCard: { padding: 18, marginBottom: 22, gap: 10, ...design.card },
  infoTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoEyebrow: { ...design.eyebrow, color: colors.primary },
  assignTitle: { ...design.sectionTitle, fontSize: 19 },
  assignDesc: { ...design.body },
  briefChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  briefChipText: {
    flex: 1,
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dueBadgeLate: { backgroundColor: colors.errorSoft },
  dueText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  existingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.infoSoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  existingText: { fontSize: 12, fontWeight: "700", color: "#1d4ed8" },

  field: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSub,
    marginBottom: 8,
  },
  textarea: { ...design.input, minHeight: 150, paddingTop: 13 },
  charCount: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: "right",
    marginTop: 4,
  },

  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f7fcfa",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#a7d9c4",
    borderStyle: "dashed",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pickBtnText: { fontSize: 14, color: colors.text, fontWeight: "700" },
  pickBtnSub: { ...design.caption, marginTop: 1 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    ...design.card,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 14, fontWeight: "600", color: colors.text },
  fileMeta: { marginTop: 2, ...design.caption },
  removeBtn: { padding: 4 },

  aiBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 13,
    marginBottom: 20,
  },
  aiBannerText: { flex: 1, fontSize: 12.5, color: "#065f46", lineHeight: 18 },

  progressWrap: { marginBottom: 14, gap: 6 },
  progressBg: {
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressLabel: { fontSize: 12, color: colors.textMuted },

  submitWrap: { borderRadius: 18, ...elevation.brand },
  submitBtn: {
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnOff: { opacity: 0.5 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitBtnText: { fontSize: 16, fontWeight: "800", color: colors.white },

  feedbackCard: { marginTop: 22, padding: 16, gap: 8, ...design.card },
  feedbackHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  feedbackIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.infoSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackTitle: { ...design.sectionTitle, fontSize: 16.5 },
  feedbackText: { ...design.body },
  gradeText: { fontSize: 14, fontWeight: "800", color: "#1e40af" },
  rubricList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#bfdbfe",
    paddingTop: 8,
    gap: 6,
  },
  rubricTitle: { fontSize: 12, fontWeight: "700", color: "#1e40af" },
  rubricRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rubricCriterion: { flex: 1, fontSize: 12, color: "#1e3a8a" },
  rubricScore: { fontSize: 12, fontWeight: "800", color: "#1e40af" },
});
