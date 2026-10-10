import { useRouter } from "expo-router";
import {
  GroupRow,
  GroupSection,
  StaffHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";

const LINKS = [
  {
    href: "/admin/operations",
    icon: "construct-outline",
    tone: "orange",
    title: "Operations",
    subtitle: "Document processing, storage and failed jobs",
  },
  {
    href: "/admin/audit",
    icon: "list-outline",
    tone: "burgundy",
    title: "Audit log",
    subtitle: "Every administrative action with filters",
  },
  {
    href: "/admin/settings",
    icon: "settings-outline",
    tone: "slate",
    title: "System settings",
    subtitle: "Platform, security, AI, email, backups and data",
  },
] as const;

export default function AdminMore() {
  const router = useRouter();
  return (
    <StaffScreen>
      <StaffHeader
        title="More"
        subtitle="Every admin tool from the web portal."
      />
      <GroupSection title="Administration">
        {LINKS.map((link, i) => (
          <GroupRow
            key={link.href}
            icon={link.icon}
            tone={link.tone}
            label={link.title}
            subtitle={link.subtitle}
            last={i === LINKS.length - 1}
            onPress={() => router.push(link.href as any)}
          />
        ))}
      </GroupSection>
      <GroupSection title="Account">
        <GroupRow
          icon="person-outline"
          tone="indigo"
          label="Profile"
          subtitle="Photo, name, password and sign out"
          last
          onPress={() => router.push("/admin/profile" as any)}
        />
      </GroupSection>
    </StaffScreen>
  );
}
