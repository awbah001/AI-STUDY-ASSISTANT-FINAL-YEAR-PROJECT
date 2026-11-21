import { forwardRef, useState } from "react";
import { TextInput, StyleSheet, type TextInputProps } from "react-native";
import { colors } from "../../theme/colors";
import { design } from "../../theme/design";
import { FIELD_ERROR_COLOR } from "../FieldError";
import { capitalizeNameInput } from "../../../../shared/validation";

/** A field surface that forwards native input behavior and focus callbacks. */
export const FormInput = forwardRef<TextInput, TextInputProps & { personName?: boolean }>(function FormInput(
  { style, onFocus, onBlur, onChangeText, personName, ...props }, ref
) {
  const [focused, setFocused] = useState(false);
  const flat = StyleSheet.flatten(style);
  const embedded = flat?.height === "100%";
  const invalid = [FIELD_ERROR_COLOR, colors.error, "#b91c1c", "#dc2626"].includes(String(flat?.borderColor));
  return (
    <TextInput
      {...props}
      autoCapitalize={personName ? "words" : props.autoCapitalize}
      textContentType={personName ? "name" : props.textContentType}
      onChangeText={value => onChangeText?.(personName ? capitalizeNameInput(value) : value)}
      ref={ref}
      style={[!embedded && design.input, style, !embedded && { borderRadius: 20 }, focused && !invalid && !embedded && {
        borderColor: colors.primary,
        shadowOpacity: 0.18,
      }]}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    />
  );
});
