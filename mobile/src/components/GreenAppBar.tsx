import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { colors } from "../theme/colors";

export const HEADER_GREEN = "#043c34";

export function GreenAppBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.side} hitSlop={10} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.side, right ? styles.sideWide : null]}>{right}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: HEADER_GREEN },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 14,
    paddingTop: 4,
  },
  side: { width: 44, height: 40, alignItems: "center", justifyContent: "center" },
  sideWide: { width: 72, flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
  },
});
