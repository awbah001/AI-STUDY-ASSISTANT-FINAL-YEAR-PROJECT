/**
 * Cognify light theme — matches the design image exactly.
 * White/light-grey backgrounds, dark slate text, emerald green accent only.
 */
export const colors = {
  // Backgrounds
  bg: "#f4f6f9",           // page background (light grey)
  bgCard: "#ffffff",       // card / surface white
  bgElevated: "#ffffff",   // modals / elevated surfaces
  bgInput: "#f1f4f8",      // input field background

  // Accent — emerald green (used for CTAs, icons, active states only)
  primary: "#075c45",      // Cognify deep green — primary CTA and active state
  primaryDark: "#033c35",  // pressed / high-emphasis state
  primaryLight: "#e8f5ee", // subtle deep-green tint
  primaryMuted: "#c8e6d4", // selected / progress tint

  // Surface / cards
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",

  // Text
  text: "#0f172a",         // slate-900 — primary text
  textSub: "#334155",      // slate-700 — subtitles
  textMuted: "#64748b",    // slate-500 — muted / meta text
  textLight: "#94a3b8",    // slate-400 — placeholder / very dim
  textPlaceholder: "#94a3b8",

  // Borders / dividers
  border: "#e2e8f0",       // slate-200
  borderLight: "#f1f5f9",  // slate-100

  // Status colours
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  success: "#16805d",

  // Chart
  chartBar: "#075c45",
  chartBarDim: "#c8e6d4",

  // Misc
  white: "#ffffff",
  black: "#000000",
  overlay: "rgba(0,0,0,0.4)",

  // Tab bar
  tabBg: "#ffffff",
  tabActive: "#075c45",
  tabInactive: "#94a3b8",
} as const;
