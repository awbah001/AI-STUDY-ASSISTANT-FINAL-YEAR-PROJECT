import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cognify.studyassistant",
  appName: "Course-Specific AI Learning Assistant",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    // Allow HTTP API calls to local dev server (Android emulator / LAN)
    cleartext: true,
  },
};

export default config;
