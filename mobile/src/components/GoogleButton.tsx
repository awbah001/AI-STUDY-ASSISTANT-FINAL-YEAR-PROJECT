import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function GoogleButton({
  onPress,
  pending,
  disabled,
}: {
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || pending}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, (disabled || pending) && styles.disabled]}
    >
      {pending ? (
        <ActivityIndicator color="#4285F4" />
      ) : (
        <>
          <View style={styles.mark}>
            <Ionicons name="logo-google" size={18} color="#4285F4" />
          </View>
          <Text style={styles.label}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#e2e8ee",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 52,
    justifyContent: "center",
  },
  mark: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  label: { color: "#1b3348", fontSize: 15, fontWeight: "600" },
  pressed: { backgroundColor: "#f8fbfc", transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.65 },
});
