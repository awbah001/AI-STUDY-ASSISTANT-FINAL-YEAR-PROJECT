import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  BookOpen,
  Bell,
  User,
  Users,
  Layers,
  Settings as SettingsIcon,
  ShieldCheck,
  FileText,
  TrendingUp,
  Sun,
  Moon,
  GraduationCap,
  Megaphone,
  ClipboardList,
  BarChart3,
  BookMarked,
  ChevronRight,
  HelpCircle,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

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
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full rounded-2xl"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

// ── Inner layout (sidebar + main) ─────────────────────────────────────────────

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = getMenuItems(user?.role);
  const activeItem = menuItems.find((item) => item.path === location);

  // Build breadcrumb: parent section name → current page
  const sectionLabel =
    user?.role === "admin" ? "Admin Panel" :
    user?.role === "lecturer" ? "Lecturer" :
    "Dashboard";

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Sidebar ── */}
      <>
        {/* Mobile overlay */}
        {isMobile && mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col bg-white border-r border-slate-100 transition-transform duration-300",
            isMobile ? (mobileOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0",
          ].join(" ")}
        >
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-100 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-sm shadow-emerald-600/30 shrink-0">
              <img src="/logo.png" alt="Cognify" className="h-full w-full object-cover rounded-xl" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-slate-900">Cognify</span>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <li key={item.path}>
                    <button
                      type="button"
                      onClick={() => {
                        setLocation(item.path);
                        setMobileOpen(false);
                      }}
                      className={[
                        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <item.icon
                        strokeWidth={isActive ? 2.5 : 2}
                        className={[
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600",
                        ].join(" ")}
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                      {/* Active indicator dot */}
                      {isActive && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Need help? */}
          <div className="mx-3 mb-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-800">Need help?</p>
                <p className="text-[11px] text-slate-500">Visit our documentation</p>
              </div>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-100 px-3 py-3">
            <button
              type="button"
              onClick={async () => {
                await logout();
                setLocation("/login");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <LogOut strokeWidth={2} className="h-[18px] w-[18px] shrink-0" />
              Logout
            </button>
          </div>
        </aside>
      </>

      {/* ── Main area ── */}
      <div className={["flex flex-1 flex-col min-w-0", isMobile ? "" : "ml-[220px]"].join(" ")}>

        {/* Top header */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-slate-400">
              <span className="font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
                onClick={() =>
                  setLocation(
                    user?.role === "admin" ? "/admin" :
                    user?.role === "lecturer" ? "/lecturer/dashboard" :
                    "/dashboard"
                  )
                }
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

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Bell strokeWidth={2} className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() => toggleTheme?.()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            >
              {theme === "light"
                ? <Moon strokeWidth={2} className="h-[18px] w-[18px]" />
                : <Sun strokeWidth={2} className="h-[18px] w-[18px]" />
              }
            </button>

            {/* User chip */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white pl-1.5 pr-3 py-1 shadow-sm">
              <Avatar className="h-7 w-7 rounded-lg">
                {user?.avatarUrl
                  ? <AvatarImage src={user.avatarUrl} alt="" className="object-cover rounded-lg" />
                  : null}
                <AvatarFallback className="rounded-lg bg-emerald-600 text-xs font-bold text-white">
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
