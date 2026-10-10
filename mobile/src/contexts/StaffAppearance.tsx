import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { colors as light } from "../theme/colors";
import { useAuth } from "./AuthContext";

type Palette = { [K in keyof typeof light]: string };
const dark: Palette = {
  ...light,
  bg: "#10251f",
  bgCard: "#1a332b",
  bgElevated: "#1d392f",
  bgInput: "#213e34",
  surface: "#1a332b",
  surfaceAlt: "#213e34",
  text: "#effaf5",
  textSub: "#d2e8dd",
  textMuted: "#a4c0b2",
  textLight: "#91ad9f",
  textPlaceholder: "#91ad9f",
  border: "#39594b",
  borderLight: "#2d4a3e",
  primaryLight: "#244c3b",
  primaryMuted: "#375f4c",
  errorSoft: "#4a2426",
  warningSoft: "#4a3a1c",
  infoSoft: "#1f3350",
  successSoft: "#1f4535",
  violet: "#e89aae",
  violetSoft: "#40212c",
  burgundy: "#e89aae",
  burgundySoft: "#40212c",
  burgundyBorder: "#6b2a3c",
  neutralGray: "#aeb4bf",
  neutralGraySoft: "#2a2e35",
  tabBg: "#1a332b",
  tabActive: "#8ce8b7",
};
const Appearance = createContext({
  theme: "light" as "light" | "dark",
  colors: light as Palette,
  loaded: true,
  save: async (_value: "light" | "dark") => {},
});

export function StaffAppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = `cognify.lecturer.${user?.id}.theme`;
  const [saved, setSaved] = useState<{
    key: string;
    theme: "light" | "dark";
  } | null>(null);
  useEffect(() => {
    let active = true;
    if (user?.role === "lecturer")
      void AsyncStorage.getItem(key)
        .then(value => {
          if (active)
            setSaved({ key, theme: value === "dark" ? "dark" : "light" });
        })
        .catch(() => {
          if (active) setSaved({ key, theme: "light" });
        });
    return () => {
      active = false;
    };
  }, [key, user?.role]);
  const theme =
    user?.role === "lecturer" && saved?.key === key ? saved.theme : "light";
  const save = async (value: "light" | "dark") => {
    if (user?.role !== "lecturer") return;
    await AsyncStorage.setItem(key, value);
    setSaved({ key, theme: value });
  };
  return (
    <Appearance.Provider
      value={{
        theme,
        colors: theme === "dark" ? dark : light,
        loaded: user?.role !== "lecturer" || saved?.key === key,
        save,
      }}
    >
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      {children}
    </Appearance.Provider>
  );
}
export const useStaffAppearance = () => useContext(Appearance);

const darkReplacements = new Map<string, string>();
for (const key of Object.keys(light) as Array<keyof Palette>)
  if (light[key] !== dark[key]) darkReplacements.set(light[key], dark[key]);

/** Resolve a single light-palette colour (e.g. one passed as a prop) for the active theme. */
export function useStaffColor() {
  const { theme } = useStaffAppearance();
  return (value: string) =>
    theme === "light" ? value : (darkReplacements.get(value) ?? value);
}

/** Apply the lecturer palette to existing native style definitions. Other roles remain unchanged. */
export function useStaffStyles<T extends object>(styles: T): T {
  const { theme } = useStaffAppearance();
  return useMemo(() => {
    if (theme === "light") return styles;
    const replacements = darkReplacements;
    const visit = (value: unknown, property = ""): unknown => {
      if (typeof value === "string")
        return property === "color" && value === light.white
          ? value
          : (replacements.get(value) ?? value);
      if (Array.isArray(value)) return value.map(item => visit(item));
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([key, val]) => [key, visit(val, key)])
        );
      return value;
    };
    return visit(styles) as T;
  }, [styles, theme]);
}
