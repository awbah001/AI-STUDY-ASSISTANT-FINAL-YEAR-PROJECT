import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { homeForRole } from "../../src/lib/roleHome";
import {
  centerTabOptions,
  useWorkspaceTabOptions,
  toneTab,
} from "../../src/components/staff/StaffUi";

const HIDDEN = ["profile", "operations", "audit", "settings"] as const;

export default function AdminLayout() {
  const { user } = useAuth();
  const navigationStyle = useWorkspaceTabOptions();
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "admin")
    return <Redirect href={homeForRole(user.role) as any} />;

  return (
    <Tabs
      key={`admin-${user.id}`}
      initialRouteName="index"
      backBehavior="history"
      screenOptions={navigationStyle}
    >
      <Tabs.Screen
        name="index"
        options={toneTab("Overview", "grid", "grid-outline", "emerald")}
      />
      <Tabs.Screen
        name="users"
        options={toneTab("Users", "people", "people-outline", "blue")}
      />
      <Tabs.Screen
        name="academic"
        options={centerTabOptions("Academic", "school")}
      />
      <Tabs.Screen
        name="announcements"
        options={toneTab("Announce", "megaphone", "megaphone-outline", "orange")}
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
