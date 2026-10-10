import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { homeForRole } from "../../src/lib/roleHome";
import {
  centerTabOptions,
  useWorkspaceTabOptions,
  toneTab,
} from "../../src/components/staff/StaffUi";

const HIDDEN = [
  "grading",
  "profile",
  "students",
  "analytics",
  "reports",
  "settings",
] as const;

export default function LecturerLayout() {
  const { user } = useAuth();
  const navigationStyle = useWorkspaceTabOptions();
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "lecturer")
    return <Redirect href={homeForRole(user.role) as any} />;

  return (
    <Tabs
      key={`lecturer-${user.id}`}
      initialRouteName="index"
      backBehavior="history"
      screenOptions={navigationStyle}
    >
      <Tabs.Screen
        name="index"
        options={toneTab("Dashboard", "home", "home-outline", "emerald")}
      />
      <Tabs.Screen
        name="courses"
        options={toneTab("Courses", "book", "book-outline", "blue")}
      />
      <Tabs.Screen
        name="assessments"
        options={centerTabOptions("Assessments", "checkmark-done")}
      />
      <Tabs.Screen
        name="announcements"
        options={toneTab("Announce", "megaphone", "megaphone-outline", "pink")}
      />
      <Tabs.Screen
        name="more"
        options={toneTab("More", "apps", "apps-outline", "violet")}
      />
      {HIDDEN.map(name => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
