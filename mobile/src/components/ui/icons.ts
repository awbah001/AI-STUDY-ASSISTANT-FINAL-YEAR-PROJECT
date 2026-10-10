import { Ionicons } from "@expo/vector-icons";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Icon colour flavours used alongside the green brand colour. */
export const ICON_TONES = {
  emerald: { fg: "#059669", bg: "#e3f7ef" },
  blue: { fg: "#2563eb", bg: "#e8f0ff" },
  violet: { fg: "#7c3aed", bg: "#f1ebff" },
  amber: { fg: "#d97706", bg: "#fff4dd" },
  pink: { fg: "#db2777", bg: "#fdebf4" },
  sky: { fg: "#0284c7", bg: "#e3f4fd" },
  orange: { fg: "#ea580c", bg: "#ffeee3" },
  teal: { fg: "#0d9488", bg: "#e0f6f3" },
  indigo: { fg: "#4f46e5", bg: "#ebebff" },
  burgundy: { fg: "#800020", bg: "#f8edf0" },
  slate: { fg: "#6b7280", bg: "#f3f4f6" },
} as const;

export type IconToneName = keyof typeof ICON_TONES;
export type IconTone = (typeof ICON_TONES)[IconToneName];

// Slate is reserved for explicit use (e.g. settings) so automatic picks stay colourful.
const TONE_LIST: IconTone[] = Object.entries(ICON_TONES)
  .filter(([name]) => name !== "slate")
  .map(([, tone]) => tone);

/** Stable colour for an icon name, so the same icon always gets the same flavour. */
export function toneForIcon(name: string): IconTone {
  const key = name.replace(/-(outline|sharp)$/, "");
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TONE_LIST[hash % TONE_LIST.length];
}

/** Filled variant of an Ionicons name, used inside tinted tiles for a two-tone look. */
export function solidIcon(name: IconName): IconName {
  const solid = String(name).replace(/-outline$/, "");
  return solid in Ionicons.glyphMap ? (solid as IconName) : name;
}

/** Appends an alpha channel to a #rrggbb colour; other formats fall back to `fallback`. */
export function withAlpha(color: string, alpha: number, fallback = "transparent"): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return fallback;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color}${a}`;
}
