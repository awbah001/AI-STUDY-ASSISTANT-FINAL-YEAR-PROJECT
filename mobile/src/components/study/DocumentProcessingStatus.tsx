import { Text, TouchableOpacity, View } from "react-native";
import { trpc } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { colors } from "../../theme/colors";

export function DocumentProcessingStatus({ doc }: { doc: { id: number; userId: number; processingStatus: string; processingError?: string | null } }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const retry = trpc.documents.retryProcessing.useMutation({ onSuccess: () => { void utils.documents.get.invalidate({ id: doc.id }); void utils.documents.list.invalidate(); } });
  const labels: Record<string, string> = { pending: "Queued for processing", processing: "Processing document…", ready: "Ready for AI study", failed: "Processing failed" };
  return <View style={{ padding: 12, gap: 6, backgroundColor: doc.processingStatus === "failed" ? "#fff7ed" : "#e8fdf2", borderRadius: 12 }}>
    <Text style={{ color: colors.text }}>{labels[doc.processingStatus] ?? "Queued for processing"}</Text>
    {doc.processingStatus === "failed" && <>
      <Text style={{ color: colors.textMuted }}>{doc.processingError || "Could not process this document."}</Text>
    </>}
    {doc.processingStatus !== "ready" && (user?.id === doc.userId || user?.role === "admin") && <TouchableOpacity disabled={retry.isPending} onPress={() => retry.mutate({ id: doc.id })}><Text style={{ color: colors.primary }}>{retry.isPending ? "Retrying…" : "Retry processing"}</Text></TouchableOpacity>}
    {retry.error && <Text>{retry.error.message}</Text>}
  </View>;
}
