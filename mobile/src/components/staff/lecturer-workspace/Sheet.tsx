import { design } from "../../../theme/design";
import { useStaffStyles } from "../../../contexts/StaffAppearance";
import { useRef, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../../theme/colors";

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string | null;
  subtitle?: string | null;
  children: ReactNode;
}) {
  const st = useStaffStyles(baseStyles);

  const last = useRef<{
    title?: string | null;
    subtitle?: string | null;
    children: ReactNode;
  }>({ title, subtitle, children });
  if (visible) last.current = { title, subtitle, children };
  const shown = last.current;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={st.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={st.dismiss}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View style={st.sheet}>
          <View style={st.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {shown.title ? <Text style={st.title}>{shown.title}</Text> : null}
            {shown.subtitle ? (
              <Text style={st.subtitle}>{shown.subtitle}</Text>
            ) : null}
            {shown.children}
            <TouchableOpacity style={st.cancel} onPress={onClose}>
              <Text style={st.cancelText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  dismiss: { flex: 1 },
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "90%",
    ...design.sheet,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: { ...design.sectionTitle },
  subtitle: { marginTop: 4, marginBottom: 14, ...design.body },
  cancel: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  cancelText: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
});
