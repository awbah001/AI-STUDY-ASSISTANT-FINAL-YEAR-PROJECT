import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { colors } from "../theme/colors";

/** Bottom colour of the app bar gradient; screens use it behind their rounded sheet. */
export const HEADER_GREEN = "#063f33";

export function GreenAppBar({
  title,
  onBack,
  right,
  children,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <LinearGradient colors={["#0b6f53", HEADER_GREEN]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <View pointerEvents="none" style={styles.ring} />
      <SafeAreaView edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.row}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.back}
              hitSlop={10}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.side} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.side, right ? styles.sideWide : null]}>
            {right}
          </View>
        </View>
        {children ? <View style={styles.extra}>{children}</View> : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    top: -120,
    right: -90,
  },
  extra: { paddingHorizontal: 20, paddingBottom: 26, marginTop: -4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 18,
    paddingTop: 6,
  },
  side: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  sideWide: {
    width: 76,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
