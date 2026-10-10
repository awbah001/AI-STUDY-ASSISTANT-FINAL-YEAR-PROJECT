import { design } from "../theme/design";
import {
  useStaffStyles,
  useStaffAppearance,
} from "../contexts/StaffAppearance";
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
  const styles = useStaffStyles(baseStyles);
  const { colors } = useStaffAppearance();

  const goBack = useGoBack(fallback);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={goBack}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={21} color={colors.text} />
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

const baseStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  btn: { ...design.iconButton },
  textCol: { flex: 1 },
  title: { ...design.sectionTitle },
  subtitle: { marginTop: 2, ...design.caption },
});
