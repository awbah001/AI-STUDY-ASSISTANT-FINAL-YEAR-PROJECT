import { design } from "../../src/theme/design";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { trpc } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { BackHeader } from "../../src/components/BackHeader";
import {
  ChipSelect,
  EmptyState,
  Loading,
  StaffScreen,
} from "../../src/components/staff/StaffUi";
import {
  AccessSection,
  AccountSection,
  AcademicSettingsSection,
  AdvancedSection,
  AiSection,
  ContentSection,
  DataSection,
  FeaturesSection,
  MonitoringSection,
  PlatformSection,
  SecuritySection,
} from "../../src/components/staff/admin/SettingsSections";
import {
  findSystemSettingsError,
  type SystemSettings,
} from "../../../shared/adminSettings";

type Section =
  | "account"
  | "security"
  | "access"
  | "platform"
  | "academic"
  | "ai"
  | "content"
  | "features"
  | "data"
  | "monitoring"
  | "advanced";

const SECTIONS: Array<{ value: Section; label: string; blurb: string }> = [
  {
    value: "account",
    label: "Account",
    blurb: "Your details and alert preferences.",
  },
  {
    value: "security",
    label: "Security",
    blurb: "Two-factor, password policy, sessions and security events.",
  },
  {
    value: "access",
    label: "Roles",
    blurb: "What admins, lecturers and students are allowed to do.",
  },
  {
    value: "platform",
    label: "Platform",
    blurb: "Maintenance mode, identity, branding and system notifications.",
  },
  {
    value: "academic",
    label: "Academic",
    blurb: "Academic year, faculties, levels and grading defaults.",
  },
  {
    value: "ai",
    label: "AI",
    blurb: "Groq connection, model parameters and document retrieval.",
  },
  {
    value: "content",
    label: "Content",
    blurb: "Upload limits and quiz and assignment defaults.",
  },
  {
    value: "features",
    label: "Features",
    blurb: "Turn platform features on or off for everyone.",
  },
  {
    value: "data",
    label: "Data",
    blurb: "Storage, backups, exports and retention.",
  },
  {
    value: "monitoring",
    label: "Health",
    blurb: "System health, integrations and recent activity.",
  },
  {
    value: "advanced",
    label: "Advanced",
    blurb: "Re-indexing and configuration reset (Super Admin).",
  },
];

function isSection(value: unknown): value is Section {
  return SECTIONS.some(s => s.value === value);
}

export default function AdminSettings() {
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<Section>("account");
  const utils = trpc.useUtils();
  const bundle = trpc.admin.settings.get.useQuery();

  useEffect(() => {
    if (isSection(params.section)) setSection(params.section);
  }, [params.section]);

  const save = trpc.admin.settings.save.useMutation({
    onSuccess: () => {
      void utils.admin.settings.get.invalidate();
      Alert.alert("Settings saved", "Your changes are live.");
    },
    onError: err => Alert.alert("Could not save settings", err.message),
  });

  const refetch = () => void bundle.refetch();
  const current = SECTIONS.find(s => s.value === section)!;
  const data = bundle.data;

  const saveProps = data
    ? {
        settings: data.settings,
        save: (patch: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...data.settings };
          for (const [key, value] of Object.entries(patch)) {
            const prev = next[key];
            next[key] =
              prev && typeof prev === "object" && value && typeof value === "object" && !Array.isArray(value)
                ? { ...prev, ...value }
                : value;
          }
          const problem = findSystemSettingsError(next as unknown as SystemSettings);
          if (problem) {
            Alert.alert("Check your settings", problem);
            return;
          }
          save.mutate({ patch });
        },
        saving: save.isPending,
      }
    : null;

  return (
    <StaffScreen onRefresh={() => bundle.refetch()}>
      <BackHeader
        title="System settings"
        subtitle="Everything from the web settings page"
        fallback="/admin/more"
      />

      <ChipSelect<Section>
        value={section}
        onChange={setSection}
        options={SECTIONS.map(s => ({ value: s.value, label: s.label }))}
      />
      <View style={st.intro}>
        <Text style={st.introTitle}>{current.label}</Text>
        <Text style={st.introBody}>{current.blurb}</Text>
      </View>

      {bundle.isLoading ? (
        <Loading />
      ) : bundle.error || !data || !saveProps ? (
        <EmptyState
          icon="alert-circle-outline"
          text={bundle.error?.message ?? "Could not load settings."}
        />
      ) : section === "account" ? (
        <AccountSection me={data.me} onChanged={refetch} />
      ) : section === "security" ? (
        <SecuritySection me={data.me} onChanged={refetch} {...saveProps} />
      ) : section === "access" ? (
        <AccessSection {...saveProps} />
      ) : section === "platform" ? (
        <PlatformSection {...saveProps} />
      ) : section === "academic" ? (
        <AcademicSettingsSection {...saveProps} />
      ) : section === "ai" ? (
        <AiSection {...saveProps} />
      ) : section === "content" ? (
        <ContentSection {...saveProps} />
      ) : section === "features" ? (
        <FeaturesSection {...saveProps} />
      ) : section === "data" ? (
        <DataSection {...saveProps} superAdmin={data.me.isSuperAdmin} />
      ) : section === "monitoring" ? (
        <MonitoringSection />
      ) : (
        <AdvancedSection superAdmin={data.me.isSuperAdmin} onReset={refetch} />
      )}
    </StaffScreen>
  );
}

const st = StyleSheet.create({
  intro: { marginTop: 6, marginBottom: 14 },
  introTitle: { ...design.sectionTitle },
  introBody: { marginTop: 2, ...design.body },
});
