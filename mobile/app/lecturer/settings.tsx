import { design } from "../../src/theme/design";
import { useStaffStyles } from "../../src/contexts/StaffAppearance";
import { useStaffAppearance } from "../../src/contexts/StaffAppearance";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../src/lib/api";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  useLecturerQuizLength,
  QUIZ_LENGTHS,
} from "../../src/lib/lecturerPreferences";
import { colors } from "../../src/theme/colors";
import { BackHeader } from "../../src/components/BackHeader";
import {
  Card,
  ChipSelect,
  Loading,
  PrimaryButton,
  StaffScreen,
} from "../../src/components/staff/StaffUi";

type IconName = ComponentProps<typeof Ionicons>["name"];

const LOGIN_METHODS: Record<string, string> = {
  local: "Email & password",
  google: "Google",
};

export default function LecturerSettings() {
  const st = useStaffStyles(baseStyles);

  const appearance = useStaffAppearance();
  const router = useRouter();
  const { user } = useAuth();
  const me = trpc.auth.me.useQuery(undefined, { enabled: !!user });
  const {
    quizLength: savedLength,
    loaded,
    save,
  } = useLecturerQuizLength(user?.id);
  const [quizLength, setQuizLength] = useState(savedLength);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded) setQuizLength(savedLength);
  }, [loaded, savedLength]);

  const loginMethod = me.data?.loginMethod ?? null;

  const savePreferences = async () => {
    setSaving(true);
    try {
      await save(quizLength);
      Alert.alert("Saved", "Teaching preferences saved.");
    } catch {
      Alert.alert(
        "Could not save",
        "Unable to save preferences on this device."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <StaffScreen onRefresh={() => me.refetch()}>
      <BackHeader
        title="Settings"
        subtitle="Workspace and teaching preferences"
        fallback="/lecturer/more"
      />

      <Section
        icon="color-palette-outline"
        title="Appearance"
        body="Customize how your lecturer workspace looks."
      >
        <ChipSelect
          value={appearance.theme}
          onChange={(value: "light" | "dark") => {
            void appearance
              .save(value)
              .catch(() =>
                Alert.alert("Could not save appearance", "Please try again.")
              );
          }}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Section>
      <Section
        icon="book-outline"
        title="Teaching preferences"
        body="Defaults used when you create course quizzes."
      >
        <Text style={st.rowTitle}>Default quiz length</Text>
        <Text style={st.rowHint}>Saved for your account on this device.</Text>
        {loaded ? (
          <ChipSelect<number>
            value={quizLength}
            onChange={setQuizLength}
            options={QUIZ_LENGTHS.map(n => ({
              value: n,
              label: `${n} questions`,
            }))}
          />
        ) : (
          <Loading />
        )}
        <PrimaryButton
          label="Save preferences"
          icon="save-outline"
          loading={saving}
          disabled={!user || !loaded || quizLength === savedLength}
          onPress={() => void savePreferences()}
        />
      </Section>

      <Section
        icon="shield-checkmark-outline"
        title="Account & security"
        body="Keep your information and sign-in details up to date."
      >
        <Row
          title="Profile"
          hint="Your display name and photo."
          action="Manage profile"
          onPress={() => router.push("/lecturer/profile" as any)}
        />
        <Row
          title="Sign-in method"
          hint={loginMethod ? (LOGIN_METHODS[loginMethod] ?? loginMethod) : "—"}
          action={loginMethod === "local" ? "Change password" : undefined}
          onPress={
            loginMethod === "local"
              ? () => router.push("/lecturer/profile" as any)
              : undefined
          }
        />
      </Section>

      <Section
        icon="information-circle-outline"
        title="About your workspace"
        body="Course-Specific AI Learning Assistant lecturer portal."
      >
        <Row title="Account" value={user?.email ?? "—"} />
        <Row title="Role" value="Lecturer" />
        <Row
          title="Courses"
          action="View assigned courses"
          onPress={() => router.push("/lecturer/courses" as any)}
        />
      </Section>
    </StaffScreen>
  );
}

function Section({
  icon,
  title,
  body,
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  children: ReactNode;
}) {
  const st = useStaffStyles(baseStyles);

  return (
    <Card>
      <View style={st.sectionHead}>
        <View style={st.sectionIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.sectionTitle}>{title}</Text>
          <Text style={st.sectionBody}>{body}</Text>
        </View>
      </View>
      {children}
    </Card>
  );
}

function Row({
  title,
  hint,
  value,
  action,
  onPress,
}: {
  title: string;
  hint?: string;
  value?: string;
  action?: string;
  onPress?: () => void;
}) {
  const st = useStaffStyles(baseStyles);

  const content = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={st.rowTitle}>{title}</Text>
        {hint ? <Text style={st.rowSub}>{hint}</Text> : null}
      </View>
      {value ? (
        <Text style={st.rowValue} numberOfLines={2}>
          {value}
        </Text>
      ) : null}
      {action ? (
        <View style={st.actionWrap}>
          <Text style={st.action}>{action}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      ) : null}
    </>
  );
  return onPress ? (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  ) : (
    <View style={st.row}>{content}</View>
  );
}

const baseStyles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { ...design.sectionTitle },
  sectionBody: { marginTop: 2, ...design.body },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rowTitle: { ...design.cardTitle },
  rowHint: { marginTop: 2, marginBottom: 10, ...design.caption },
  rowSub: { marginTop: 2, ...design.caption },
  rowValue: {
    maxWidth: "60%",
    fontSize: 13,
    color: colors.textSub,
    textAlign: "right",
  },
  actionWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  action: { fontSize: 13, fontWeight: "700", color: colors.primary },
});
