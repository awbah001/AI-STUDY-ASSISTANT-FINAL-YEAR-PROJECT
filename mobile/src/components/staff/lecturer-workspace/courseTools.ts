import { Alert, Linking, StyleSheet } from "react-native";
import {
  pickFile,
  resolveFileUrl,
  type PickedFile,
} from "../../../lib/uploadFile";
import {
  isAllowedStudyDocument,
  STUDY_DOC_ERROR,
  STUDY_DOC_MIMES,
} from "../../../../../shared/studyDocuments";
import { colors } from "../../../theme/colors";

export async function pickCourseFile(): Promise<PickedFile | null> {
  const file = await pickFile([...STUDY_DOC_MIMES]);
  if (!file) return null;
  if (!isAllowedStudyDocument(file.name, file.mimeType))
    throw new Error(STUDY_DOC_ERROR);
  if (file.size > 60 * 1024 * 1024)
    throw new Error("Maximum file size is 60 MB.");
  return file;
}
export function openCourseFile(url: string) {
  void Linking.openURL(resolveFileUrl(url)).catch(() =>
    Alert.alert("Cannot open file", "No app is available to open this file.")
  );
}
export function courseError(error: unknown) {
  Alert.alert(
    "Unable to complete action",
    error instanceof Error ? error.message : "Please try again."
  );
}
export function confirmCourseDelete(title: string, action: () => void) {
  Alert.alert("Delete", `Delete ${title}? This cannot be undone.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: action },
  ]);
}
/** Parse an explicit local deadline without allowing Date to normalize invalid dates. */
export function parseCourseDeadline(value: string): Date | undefined {
  if (!value.trim()) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match)
    throw new Error(
      "Use YYYY-MM-DD HH:mm for the deadline, in your local time."
    );
  const [, y, m, d, h, min] = match.map(Number);
  const date = new Date(y, m - 1, d, h, min);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== min
  )
    throw new Error("Enter a valid date and time.");
  return date;
}
/** Field message for a "YYYY-MM-DD HH:mm" deadline; empty is allowed. */
export function courseDeadlineError(value: string, label = "Deadline"): string | null {
  try {
    const date = parseCourseDeadline(value);
    if (date && date.getTime() <= Date.now()) return `${label} must be in the future.`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Enter a valid date and time.";
  }
}
export function parseCourseRubric(value: string) {
  if (!value.trim()) return undefined;
  const rubric = value.split(",").map(row => {
    const split = row.lastIndexOf(":");
    return {
      criterion: split >= 0 ? row.slice(0, split).trim() : "",
      maxPoints: Number(split >= 0 ? row.slice(split + 1).trim() : NaN),
    };
  });
  if (
    rubric.length > 12 ||
    rubric.some(
      r => !r.criterion || !Number.isFinite(r.maxPoints) || r.maxPoints <= 0
    )
  )
    throw new Error(
      "Use up to 12 criteria, such as Research: 30, Analysis: 40. Every score must be greater than zero."
    );
  if (
    new Set(rubric.map(r => r.criterion.toLowerCase())).size !== rubric.length
  )
    throw new Error("Each rubric criterion must have a unique name.");
  return rubric;
}
export const courseStyles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: colors.textSub,
    lineHeight: 21,
    marginBottom: 10,
  },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  actions: { gap: 10, marginTop: 10 },
  correct: {
    color: colors.success,
    fontWeight: "700",
    backgroundColor: colors.primaryLight,
    padding: 10,
    marginBottom: 6,
    borderRadius: 8,
  },
  option: {
    color: colors.textSub,
    padding: 10,
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
});
