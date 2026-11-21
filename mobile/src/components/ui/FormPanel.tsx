import { LinearGradient } from "expo-linear-gradient";
import type { ViewProps } from "react-native";
import { colors } from "../../theme/colors";
import { design } from "../../theme/design";

/** Presentation only: field order, keyboard handling and actions belong to the caller. */
export function FormPanel({ style, ...props }: ViewProps) {
  return (
    <LinearGradient
      {...props}
      colors={[colors.surface, colors.surfaceAlt]}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={[design.form, style]}
    />
  );
}
