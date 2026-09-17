// Redirect old /documents route to the new /library tab
import { Redirect } from "expo-router";
export default function DocumentsRedirect() {
  return <Redirect href="/(tabs)/library" />;
}
