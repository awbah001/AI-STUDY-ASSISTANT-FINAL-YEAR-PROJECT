import { Tabs } from "expo-router";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

function AskAITabButton(props: BottomTabBarButtonProps) {
  return (
    <TouchableOpacity
      {...(props as any)}
      style={styles.fabWrapper}
      activeOpacity={0.85}
    >
      <View style={styles.fab}>
        <Ionicons name="sparkles" size={24} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  return (
    <Tabs
      key={user?.id != null ? `tabs-${user.id}` : "tabs-guest"}
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#9aa3af",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: "Courses",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "book" : "book-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="askai"
        options={{
          title: "Ask AI",
          tabBarIcon: () => (
            <Ionicons name="sparkles" size={24} color={colors.white} />
          ),
          tabBarButton: (props) => <AskAITabButton {...props} />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="flashcards" options={{ href: null }} />
      <Tabs.Screen name="quizzes" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: "#eef1f4",
    height: Platform.OS === "ios" ? 84 : 64,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  fabWrapper: {
    top: -20,
    alignItems: "center",
    justifyContent: "center",
    width: 64,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
});
