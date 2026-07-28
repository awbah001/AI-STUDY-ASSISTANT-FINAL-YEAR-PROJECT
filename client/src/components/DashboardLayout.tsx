import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, BookOpen, Bell, User, Users, Layers,
  Settings as SettingsIcon, ShieldCheck, FileText, TrendingUp,
  Sun, Moon, GraduationCap, Megaphone, ClipboardList, BarChart3,
  BookMarked, ChevronRight, HelpCircle, Menu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

// ── Role-based theme config ────────────────────────────────────────────────────

const ROLE_THEME = {
  admin: {
    sidebar: "bg-sky-100/60 backdrop-blur-xl",
    sidebarBorder: "border-sky-200/50",
    logoBg: "bg-sky-600 shadow-sky-500/30",
    activeItem: "bg-sky-500 text-white shadow-md shadow-sky-500/30",
    activeIcon: "text-white",
    activeDot: "bg-white",
    inactiveItem: "text-sky-900 hover:bg-sky-200/60 hover:text-sky-950",
    inactiveIcon: "text-sky-500 group-hover:text-sky-700",
    helpCard: "bg-sky-200/50 border-sky-300/40",
    helpText: "text-sky-900",
    helpSubtext: "text-sky-600",
    helpBtn: "bg-sky-500 hover:bg-sky-600",
    logoutText: "text-sky-700 hover:bg-sky-200/60 hover:text-sky-950",
    logoBorderBottom: "border-sky-200/50",
    logoutBorderTop: "border-sky-200/50",
    breadcrumb: "text-sky-600 hover:text-sky-800",
    label: "Admin Portal",
  },
  lecturer: {
    sidebar: "bg-sky-100/60 backdrop-blur-xl",
    sidebarBorder: "border-sky-200/50",
    logoBg: "bg-indigo-500 shadow-indigo-500/30",
    activeItem: "bg-indigo-500 text-white shadow-md shadow-indigo-500/30",
    activeIcon: "text-white",
    activeDot: "bg-white",
    inactiveItem: "text-sky-900 hover:bg-sky-200/60 hover:text-sky-950",
    inactiveIcon: "text-sky-500 group-hover:text-sky-700",
    helpCard: "bg-sky-200/50 border-sky-300/40",
    helpText: "text-sky-900",
    helpSubtext: "text-sky-600",
    helpBtn: "bg-indigo-500 hover:bg-indigo-600",
    logoutText: "text-sky-700 hover:bg-sky-200/60 hover:text-sky-950",
    logoBorderBottom: "border-sky-200/50",
    logoutBorderTop: "border-sky-200/50",
    breadcrumb: "text-indigo-500 hover:text-indigo-700",
    label: "Lecturer Portal",
  },
  user: {
    sidebar: "bg-white",
    sidebarBorder: "border-slate-100",
    logoBg: "bg-emerald-600 shadow-emerald-600/30",
    activeItem: "bg-emerald-50 text-emerald-700",
    activeIcon: "text-emerald-600",
    activeDot: "bg-emerald-500",
    inactiveItem: "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    inactiveIcon: "text-slate-400 group-hover:text-slate-600",
    helpCard: "bg-slate-50 border-slate-100",
    helpText: "text-slate-800",
    helpSubtext: "text-slate-500",
    helpBtn: "bg-emerald-500 hover:bg-emerald-600",
    logoutText: "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
    logoBorderBottom: "border-slate-100",
    logoutBorderTop: "border-slate-100",
    breadcrumb: "text-emerald-600 hover:text-emerald-700",
    label: "Dashboard",
  },
} as const;

type Role = keyof typeof ROLE_THEME;

// ── Menu items per role ────────────────────────────────────────────────────────

const getMenuItems = (role: string = "user") => {
  if (role === "admin") {
    return [
      { icon: ShieldCheck, label: "Admin Panel", path: "/admin" },
      { icon: Users, label: "User Management", path: "/admin/users" },
      { icon: FileText, label: "Content Management", path: "/admin/content" },
      { icon: User, label: "Profile", path: "/profile" },
      { icon: SettingsIcon, label: "Settings", path: "/settings" },
    ];
  }
  if (role === "lecturer") {
    return [
      { icon: LayoutDashboard, label: "Dashboard", path: "/lecturer/dashboard" },
      { icon: BookMarked, label: "Courses", path: "/lecturer/courses" },
      { icon: Users, label: "Students", path: "/lecturer/students" },
      { icon: BarChart3, label: "Analytics", path: "/lecturer/analytics" },
      { icon: Megaphone, label: "Announcements", path: "/lecturer/announcements" },
      { icon: ClipboardList, label: "Reports", path: "/lecturer/reports" },
      { icon: User, label: "Profile", path: "/profile" },
      { icon: SettingsIcon, label: "Settings", path: "/settings" },
    ];
  }
  return [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: BookOpen, label: "Documents", path: "/documents" },
    { icon: GraduationCap, label: "My Courses", path: "/courses" },
    { icon: Layers, label: "Flashcards", path: "/flashcards" },
    { icon: TrendingUp, label: "Progress", path: "/progress" },
    { icon: User, label: "Profile", path: "/profile" },
    { icon: SettingsIcon, label: "Settings", path: "/settings" },
  ];
};

// ── Root layout ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex max-w-md w-full flex-col items-center gap-8 p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-center">Sign in to continue</h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Access to this dashboard requires authentication.
          </p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full rounded-2xl">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

// ── Inner layout ───────────────────────────────────────────────────────────────

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (user?.role ?? "user") as Role;
  const t = ROLE_THEME[role] ?? ROLE_THEME.user;
  const menuItems = getMenuItems(role);
  const activeItem = menuItems.find((item) => item.path === location);

  const sectionLabel = t.label;

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={[
        "fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r transition-transform duration-300",
        role !== "user" ? "sidebar-glass" : t.sidebar,
        t.sidebarBorder,
        isMobile ? (mobileOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0",
      ].join(" ")}>

        {/* Logo */}
        <div className={`flex h-16 shrink-0 items-center gap-2.5 border-b px-5 ${t.logoBorderBottom}`}>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md ${t.logoBg}`}>
            <img src="/logo.png" alt="Cognify" className="h-full w-full object-cover rounded-xl" />
          </div>
          <span className={`text-[17px] font-bold tracking-tight ${role === "user" ? "text-slate-900" : "text-sky-900"}`}>
            Cognify
          </span>
        </div>

        {/* Role badge */}
        <div className="px-4 pt-3 pb-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${role === "admin" ? "text-red-400" : role === "lecturer" ? "text-indigo-400" : "text-emerald-500"}`}>
            {sectionLabel}
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-0.5">
            {menuItems.map((item) => {
              const isActive = location === item.path;
              return (
                <li key={item.path}>
                  <button
                    type="button"
                    onClick={() => { setLocation(item.path); setMobileOpen(false); }}
                    className={[
                      "sidebar-nav-item group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium",
                      "transition-all duration-200",
                      isActive ? t.activeItem : t.inactiveItem,
                    ].join(" ")}
                  >
                    <item.icon
                      strokeWidth={isActive ? 2.5 : 2}
                      className={[
                        "h-[18px] w-[18px] shrink-0 transition-colors duration-200",
                        isActive ? t.activeIcon : t.inactiveIcon,
                      ].join(" ")}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {/* Animated active dot — pops in when active */}
                    {isActive && (
                      <span className={`sidebar-active-dot absolute right-2.5 top-1/2 h-1.5 w-1.5 rounded-full ${t.activeDot}`} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Need help? */}
        <div className={`mx-3 mb-3 rounded-2xl border px-4 py-3 ${t.helpCard}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[13px] font-semibold ${t.helpText}`}>Need help?</p>
              <p className={`text-[11px] ${t.helpSubtext}`}>Visit our documentation</p>
            </div>
            <button type="button" className={`flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm transition-colors ${t.helpBtn}`}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Logout */}
        <div className={`border-t px-3 py-3 ${t.logoutBorderTop}`}>
          <button
            type="button"
            onClick={async () => {
              await logout();
              // Use replace() so the browser history entry is cleared —
              // pressing Back after logout will NOT return to protected pages
              window.location.replace("/login");
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ${t.logoutText}`}
          >
            <LogOut strokeWidth={2} className="h-[18px] w-[18px] shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className={["flex flex-1 flex-col min-w-0", isMobile ? "" : "ml-[220px]"].join(" ")}>

        {/* Top header */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex items-center gap-3 min-w-0">
            {isMobile && (
              <button type="button" onClick={() => setMobileOpen(true)}
                className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            )}
            <nav className="flex items-center gap-1.5 text-sm text-slate-400">
              <span
                className={`cursor-pointer font-medium transition-colors ${t.breadcrumb}`}
                onClick={() => setLocation(role === "admin" ? "/admin" : role === "lecturer" ? "/lecturer/dashboard" : "/dashboard")}
              >
                {sectionLabel}
              </span>
              {activeItem && activeItem.label !== sectionLabel && (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span className="text-slate-500">{activeItem.label}</span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors">
              <Bell strokeWidth={2} className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </button>
            <button type="button" aria-label="Toggle theme" onClick={() => toggleTheme?.()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors">
              {theme === "light" ? <Moon strokeWidth={2} className="h-[18px] w-[18px]" /> : <Sun strokeWidth={2} className="h-[18px] w-[18px]" />}
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white pl-1.5 pr-3 py-1 shadow-sm">
              <Avatar className="h-7 w-7 rounded-lg">
                {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" className="object-cover rounded-lg" /> : null}
                <AvatarFallback className={`rounded-lg text-xs font-bold text-white ${role === "admin" ? "bg-sky-600" : role === "lecturer" ? "bg-indigo-500" : "bg-emerald-600"}`}>
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block leading-none">
                <p className="text-[13px] font-semibold text-slate-900 truncate max-w-[140px]">{user?.name}</p>
                <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{user?.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
