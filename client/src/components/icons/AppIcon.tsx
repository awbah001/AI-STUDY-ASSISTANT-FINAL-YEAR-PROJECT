import type { CSSProperties, ComponentType } from "react";
import { useReducedMotion } from "motion/react";
import {
  Activity, Archive, ArrowUp, BarChart3, Bell, BookMarked, BookOpen, Bot,
  Brain, BrainCircuit, Building2, Calendar, CalendarCheck, CalendarClock,
  CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardCheck,
  Database, Download, FileQuestion, FileStack, FileText, GraduationCap,
  Home, Layers, LayoutDashboard, ListChecks, LoaderCircle, LockKeyhole, LogOut, Mail, Menu,
  MessageCircleQuestion, MessagesSquare, Moon, PanelLeftClose, PanelLeftOpen,
  Pencil, Plus, Search, Server, Settings, ShieldCheck,
  Sparkles, Sun, Target, Timer, Trash2, TrendingUp, Upload, Users, X,
  type LucideIcon,
} from "lucide-react";
import {
  ActivityIcon, ArchiveIcon, BellIcon, BookmarkCheckIcon,
  AArrowUpIcon, BookTextIcon, BotMessageSquareIcon, BrainIcon, CalendarCheckIcon,
  CalendarCogIcon, CalendarDaysIcon, CheckIcon, CircleCheckIcon,
  ChevronRightIcon, CircleHelpIcon, ClipboardCheckIcon, DatabaseIcon, DownloadIcon,
  FileChartLineIcon, FileStackIcon, FileTextIcon, GraduationCapIcon,
  LayersIcon, LayoutGridIcon, ListIcon, LoaderCircleIcon, LockKeyholeIcon, LogoutIcon, MenuIcon,
  MessageSquareIcon, MoonIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, RadioIcon,
  SearchIcon, SettingsIcon, ShieldCheckIcon, SparklesIcon,
  PlusIcon, SunIcon, TimerIcon, TrendingUpIcon, UploadIcon, UsersRoundIcon, XIcon,
} from "lucide-animated";

type AnimatedIconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  animateOnHover?: boolean;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
  role?: string;
};
type AnimatedIcon = ComponentType<AnimatedIconProps>;

/**
 * Existing Lucide names remain the public keys. Icons without a polished
 * animated counterpart deliberately keep their static Lucide fallback.
 */
const staticIcons = {
  Activity, Archive, ArrowUp, BarChart3, Bell, BookMarked, BookOpen, Bot,
  Brain, BrainCircuit, Building2, Calendar, CalendarCheck, CalendarClock,
  CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardCheck, Database,
  Download, FileQuestion, FileStack, FileText, GraduationCap, Home, Layers,
  LayoutDashboard, ListChecks, LoaderCircle, LockKeyhole, LogOut, Mail, Menu,
  MessageCircleQuestion, MessagesSquare, Moon, PanelLeftClose, PanelLeftOpen,
  Pencil, Plus, Search, Server, Settings, ShieldCheck, Sparkles, Sun, Target,
  Timer, Trash2, TrendingUp, Upload, Users, X,
} satisfies Record<string, LucideIcon>;

const animatedIcons: Partial<Record<keyof typeof staticIcons, AnimatedIcon>> = {
  Activity: ActivityIcon,
  Archive: ArchiveIcon,
  ArrowUp: AArrowUpIcon,
  Bell: BellIcon,
  BookMarked: BookmarkCheckIcon,
  BookOpen: BookTextIcon,
  Bot: BotMessageSquareIcon,
  Brain: BrainIcon,
  CalendarCheck: CalendarCheckIcon,
  CalendarClock: CalendarCogIcon,
  CalendarDays: CalendarDaysIcon,
  Check: CheckIcon,
  CheckCircle2: CircleCheckIcon,
  ChevronRight: ChevronRightIcon,
  ClipboardCheck: ClipboardCheckIcon,
  Database: DatabaseIcon,
  Download: DownloadIcon,
  FileStack: FileStackIcon,
  FileText: FileTextIcon,
  GraduationCap: GraduationCapIcon,
  Layers: LayersIcon,
  LayoutDashboard: LayoutGridIcon,
  ListChecks: ListIcon,
  LoaderCircle: LoaderCircleIcon,
  LockKeyhole: LockKeyholeIcon,
  LogOut: LogoutIcon,
  Menu: MenuIcon,
  MessageCircleQuestion: CircleHelpIcon,
  MessagesSquare: MessageSquareIcon,
  Moon: MoonIcon,
  PanelLeftClose: PanelLeftCloseIcon,
  PanelLeftOpen: PanelLeftOpenIcon,
  Plus: PlusIcon,
  Search: SearchIcon,
  Settings: SettingsIcon,
  ShieldCheck: ShieldCheckIcon,
  Sparkles: SparklesIcon,
  Sun: SunIcon,
  Timer: TimerIcon,
  TrendingUp: TrendingUpIcon,
  Upload: UploadIcon,
  Users: UsersRoundIcon,
  X: XIcon,
};

export type IconName = keyof typeof staticIcons;
export type IconMode = "auto" | "animated" | "static";
export type IconTrigger = "hover" | "none";

export interface AppIconProps {
  /** A familiar Lucide name from the existing application inventory. */
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  mode?: IconMode;
  trigger?: IconTrigger;
  strokeWidth?: number;
  label?: string;
}

export function AppIcon({
  name,
  size = 20,
  color = "currentColor",
  className,
  style,
  mode = "auto",
  trigger = "hover",
  strokeWidth = 2,
  label,
}: AppIconProps) {
  const reduceMotion = useReducedMotion();
  const Animated = animatedIcons[name];
  const useAnimated = mode !== "static" && !reduceMotion && !!Animated;
  const accessibility = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };

  if (useAnimated && Animated) {
    return (
      <Animated
        size={size}
        className={className}
        style={{ color, ...style }}
        animateOnHover={trigger === "hover"}
        {...accessibility}
      />
    );
  }

  const Static = staticIcons[name];
  return (
    <Static
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      {...accessibility}
    />
  );
}

/** Soft mint dimensional surface for prominent dashboard and feature icons. */
export function AppIconBadge({
  name,
  size = 48,
  label,
  mode = "auto",
  className,
}: Pick<AppIconProps, "name" | "label" | "mode" | "className"> & { size?: number }) {
  return (
    <span
      className={["cognify-icon-badge", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <AppIcon name={name} size={Math.round(size * 0.48)} mode={mode} />
    </span>
  );
}
