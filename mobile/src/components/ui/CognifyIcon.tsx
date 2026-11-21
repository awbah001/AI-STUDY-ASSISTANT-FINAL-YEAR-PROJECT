import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { IconName } from "./icons";

/** Shared semantic names resolve to Expo's bundled Ionicons on native. */
export const MOBILE_ICON_REGISTRY = {
  ai: "sparkles",
  intelligence: "bulb",
  education: "school",
  book: "book",
  quiz: "help-circle",
  assessment: "clipboard",
  success: "checkmark-circle",
  progress: "trending-up",
  documents: "document-text",
  upload: "cloud-upload",
  download: "download-outline",
  planner: "calendar",
  notifications: "notifications-outline",
  messages: "chatbubble-ellipses",
  email: "mail-outline",
  security: "shield-checkmark",
  users: "people-outline",
  database: "albums",
  home: "home-outline",
  search: "search",
  settings: "settings-outline",
  next: "chevron-forward",
  previous: "chevron-back",
  add: "add",
  close: "close",
  delete: "trash-outline",
  edit: "pencil-outline",
  send: "send",
  loading: "sync-outline",
  flashcards: "layers-outline",
  library: "library-outline",
  profile: "person-outline",
} as const satisfies Record<string, IconName>;

export type CognifyIconName = keyof typeof MOBILE_ICON_REGISTRY | IconName;
export type CognifyIconMotion = "none" | "press" | "success" | "pulse";

let reduceMotionCache = false;
let reduceMotionSubscribed = false;
const reduceMotionListeners = new Set<(value: boolean) => void>();

export function resolveCognifyIcon(name: CognifyIconName): IconName {
  return (MOBILE_ICON_REGISTRY as Partial<Record<string, IconName>>)[name] ?? (name as IconName);
}

export function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(reduceMotionCache);
  useEffect(() => {
    reduceMotionListeners.add(setReduced);
    if (!reduceMotionSubscribed) {
      reduceMotionSubscribed = true;
      AccessibilityInfo.addEventListener("reduceMotionChanged", value => {
        reduceMotionCache = value;
        reduceMotionListeners.forEach(listener => listener(value));
      });
      AccessibilityInfo.isReduceMotionEnabled()
        .then(value => {
          reduceMotionCache = value;
          reduceMotionListeners.forEach(listener => listener(value));
        })
        .catch(() => undefined);
    }
    return () => { reduceMotionListeners.delete(setReduced); };
  }, []);
  return reduced;
}

export interface CognifyIconProps {
  name: CognifyIconName;
  size?: number;
  color?: ColorValue;
  motion?: CognifyIconMotion;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Native registry. It uses Expo's Ionicons and only runs short native-driver motions. */
export function CognifyIcon({
  name,
  size = 20,
  color = "#0b765b",
  motion = "none",
  label,
  style,
}: CognifyIconProps) {
  const reduced = useReducedMotionPreference();
  const scale = useRef(new Animated.Value(1)).current;
  const previousMotion = useRef<CognifyIconMotion>("none");

  useEffect(() => {
    scale.stopAnimation();
    if (reduced) {
      scale.setValue(1);
      previousMotion.current = motion;
      return;
    }
    if (motion === "pulse") {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(scale, { toValue: 1.055, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]));
      loop.start();
      previousMotion.current = motion;
      return () => loop.stop();
    }
    if (motion === "success" && previousMotion.current !== "success") {
      scale.setValue(0.88);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.08, damping: 8, stiffness: 240, mass: 0.7, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 220, mass: 0.7, useNativeDriver: true }),
      ]).start();
    } else if (motion !== "press") {
      scale.setValue(1);
    }
    previousMotion.current = motion;
  }, [motion, reduced, scale]);

  const pressScale = (toValue: number) => {
    if (reduced || motion !== "press") return;
    Animated.spring(scale, { toValue, damping: 15, stiffness: 260, mass: 0.6, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      accessible={Boolean(label)}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? "auto" : "no-hide-descendants"}
      onTouchStart={motion === "press" ? () => pressScale(0.9) : undefined}
      onTouchEnd={motion === "press" ? () => pressScale(1) : undefined}
      onTouchCancel={motion === "press" ? () => pressScale(1) : undefined}
      style={[{ transform: [{ scale }] }, style]}
    >
      <Ionicons name={resolveCognifyIcon(name)} size={size} color={color} />
    </Animated.View>
  );
}
