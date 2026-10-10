import { useRouter } from "expo-router";
import {
  GroupRow,
  GroupSection,
  StaffHeader,
  StaffScreen,
} from "../../src/components/staff/StaffUi";

const LINKS = [
  {
    href: "/lecturer/students",
    icon: "people-outline",
    tone: "violet",
    title: "Students",
    subtitle: "Everyone enrolled in your courses; enroll new students",
  },
  {
    href: "/lecturer/analytics",
    icon: "stats-chart-outline",
    tone: "sky",
    title: "Analytics",
    subtitle: "Engagement, performance and quiz attempts per course",
  },
  {
    href: "/lecturer/reports",
    icon: "document-text-outline",
    tone: "amber",
    title: "Reports",
    subtitle: "Individual student progress reports",
  },
  {
    href: "/lecturer/assessments",
    icon: "clipboard-outline",
    tone: "burgundy",
    title: "Assessments",
    subtitle: "At-risk students, missing work and assignment templates",
  },
] as const;

const ACCOUNT = [
  {
    href: "/lecturer/profile",
    icon: "person-outline",
    tone: "indigo",
    title: "Profile",
    subtitle: "Photo, name, password and sign out",
  },
  {
    href: "/lecturer/settings",
    icon: "settings-outline",
    tone: "slate",
    title: "Settings",
    subtitle: "Teaching preferences",
  },
] as const;

export default function LecturerMore() {
  const router = useRouter();
  return (
    <StaffScreen>
      <StaffHeader
        title="More"
        subtitle="Every lecturer tool from the web portal."
      />
      <GroupSection title="Workspace">
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
        {ACCOUNT.map((link, i) => (
          <GroupRow
            key={link.href}
            icon={link.icon}
            tone={link.tone}
            label={link.title}
            subtitle={link.subtitle}
            last={i === ACCOUNT.length - 1}
            onPress={() => router.push(link.href as any)}
          />
        ))}
      </GroupSection>
    </StaffScreen>
  );
}
