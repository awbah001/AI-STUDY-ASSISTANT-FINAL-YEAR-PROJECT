import { Alert, Text, TouchableOpacity } from "react-native";
import { trpc } from "../../lib/api";
import { colors } from "../../theme/colors";

export function SaveResponseNote({
  content,
  documentId = 0,
}: {
  content: string;
  documentId?: number;
}) {
  const utils = trpc.useUtils();
  const save = trpc.personalNotes.saveResponse.useMutation({
    onSuccess: () => {
      void utils.personalNotes.list.invalidate();
      Alert.alert("Saved", "Find this response in Library → Personal notes.");
    },
    onError: error => Alert.alert("Could not save note", error.message),
  });
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={save.isPending}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
      onPress={() => save.mutate({ content, documentId })}
    >
      <Text style={{ color: colors.primary, fontWeight: "600" }}>
        {save.isPending ? "Saving…" : "Save to notes"}
      </Text>
    </TouchableOpacity>
  );
}
