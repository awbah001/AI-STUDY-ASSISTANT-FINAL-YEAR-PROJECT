import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const FIELD_ERROR_COLOR = "#d93a3a";

export function FieldError({ message, style }: { message?: string | null; style?: StyleProp<ViewStyle> }) {
  if (!message) return null;
  return (
    <View style={[styles.row, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={14} color={FIELD_ERROR_COLOR} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 6, marginLeft: 2 },
  icon: { marginTop: 1 },
  text: { color: FIELD_ERROR_COLOR, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 17 },
});
