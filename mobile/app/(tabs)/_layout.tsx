import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";
import { colors } from "../../src/theme/colors";

type TabIconProps = {
  name: string;
  label: string;
  focused: boolean;
  color: string;
};

function TabIcon({ name, label, focused, color }: TabIconProps) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <Ionicons
        name={focused ? (name.replace("-outline", "") as any) : (name as any)}
        size={focused ? 22 : 20}
        color={focused ? colors.white : colors.textLight}
      />
      {focused && (
        <Text style={styles.tabLabel}>{label}</Text>
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home-outline" label="Home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="book-outline" label="Courses" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="document-text-outline" label="Docs" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="flashcards"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="layers-outline" label="Cards" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="trending-up-outline" label="Progress" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 24 : 16,
    left: 24,
    right: 24,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0f172a", // dark slate
    borderTopWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    paddingHorizontal: 8,
    paddingBottom: 0,
    paddingTop: 0,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 44,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
});
