import { Alert, Linking, Share } from "react-native";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../lib/api";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type ReviewSubmission = RouterOutputs["lecturer"]["assignments"]["reviewQueue"][number];

export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

export async function shareText(title: string, message: string) {
  try {
    await Share.share({ title, message });
  } catch (err) {
    Alert.alert("Could not share", err instanceof Error ? err.message : "Sharing is not available on this device.");
  }
}

export function openMail(email: string | null | undefined) {
  if (!email) return;
  void Linking.openURL(`mailto:${email}`).catch(() => Alert.alert("No mail app", `Email ${email} from your mail app.`));
}

export function scoreTone(score: number): "green" | "amber" | "red" {
  return score >= 70 ? "green" : score >= 50 ? "amber" : "red";
}

export function toneColor(tone: "green" | "amber" | "red") {
  return tone === "green" ? "#16805d" : tone === "amber" ? "#b45309" : "#ef4444";
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function isLateSubmission(item: Pick<ReviewSubmission, "status" | "submittedAt" | "dueDate">) {
  if (item.status === "late") return true;
  return !!item.dueDate && new Date(item.submittedAt) > new Date(item.dueDate);
}

export function submissionStatus(item: Pick<ReviewSubmission, "status" | "submittedAt" | "dueDate">) {
  if (item.status === "graded") return { label: "Graded", tone: "green" as const };
  if (isLateSubmission(item)) return { label: "Late", tone: "red" as const };
  return { label: "Submitted", tone: "amber" as const };
}
