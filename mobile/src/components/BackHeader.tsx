import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export function useGoBack(fallback: string = "/(tabs)/profile") {
  const router = useRouter();
  return () => {
    // Hidden tab screens may have no navigation history when opened directly,
    // but should still have a reliable way back to their parent tab.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate(fallback as any);
  };
}

export function BackHeader({
  title,
  subtitle,
  fallback = "/(tabs)/profile",
}: {
  title: string;
  subtitle?: string;
  fallback?: string;
}) {
  const goBack = useGoBack(fallback);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={goBack}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  textCol: { flex: 1 },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
});
