import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { SETTINGS_NAV } from "@shared/adminSettings";
import {
  LayoutDashboard, LogOut, Bell, UserRound, UsersRound, Search,
  Settings as SettingsIcon, ShieldCheck,
  Sun, Moon, GraduationCap, Megaphone, ClipboardCheck, ChartNoAxesCombined,
  LibraryBig, ChevronRight, Menu, ServerCog, School, FileBarChart,
  BotMessageSquare, Layers, ListChecks, CalendarDays, TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const ROLE_THEME = {
  admin: {
    sidebar: "bg-[#033c35]",
    label: "Admin Portal",
    home: "/admin",
    avatar: "bg-sky-600",
  },
  lecturer: {
    sidebar: "bg-[#033c35]",
    label: "Lecturer Portal",
    home: "/lecturer/dashboard",
    avatar: "bg-indigo-500",
  },
  user: {
    sidebar: "bg-[#033c35]",
    label: "Student Portal",
    home: "/student/dashboard",
    avatar: "bg-emerald-600",
  },
} as const;

type Role = keyof typeof ROLE_THEME;

type IconTone =
  | "emerald" | "blue" | "violet" | "amber" | "pink" | "sky"
  | "orange" | "teal" | "indigo" | "rose" | "gray";

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  section: "Overview" | "Workspace" | "Assessment" | "Settings" | "Account";
  tone: IconTone;
};

const getMenuItems = (role: string = "user"): MenuItem[] => {
  if (role === "admin") {
    return [
      { icon: LayoutDashboard, label: "Overview", path: "/admin", section: "Overview", tone: "emerald" },
      { icon: UsersRound, label: "Users", path: "/admin/users", section: "Workspace", tone: "blue" },
      { icon: School, label: "Academic", path: "/admin/academic", section: "Workspace", tone: "violet" },
      { icon: ServerCog, label: "Operations", path: "/admin/operations", section: "Workspace", tone: "orange" },
      { icon: ShieldCheck, label: "Audit", path: "/admin/audit", section: "Workspace", tone: "rose" },
      { icon: Megaphone, label: "Communications", path: "/admin/communications", section: "Workspace", tone: "pink" },
      { icon: SettingsIcon, label: "Settings", path: "/admin/settings", section: "Settings", tone: "gray" },
    ];
  }
  if (role === "lecturer") {
    return [
      { icon: LayoutDashboard, label: "Dashboard", path: "/lecturer/dashboard", section: "Overview", tone: "emerald" },
      { icon: LibraryBig, label: "Courses", path: "/lecturer/courses", section: "Workspace", tone: "blue" },
      { icon: UsersRound, label: "Students", path: "/lecturer/students", section: "Workspace", tone: "violet" },
      { icon: ChartNoAxesCombined, label: "Analytics", path: "/lecturer/analytics", section: "Workspace", tone: "sky" },
      { icon: Megaphone, label: "Announcements", path: "/lecturer/announcements", section: "Workspace", tone: "pink" },
      { icon: FileBarChart, label: "Reports", path: "/lecturer/reports", section: "Assessment", tone: "amber" },
      { icon: ClipboardCheck, label: "Assessments", path: "/lecturer/assessments", section: "Assessment", tone: "rose" },
      { icon: UserRound, label: "Profile", path: "/profile", section: "Account", tone: "indigo" },
      { icon: SettingsIcon, label: "Settings", path: "/settings", section: "Account", tone: "gray" },
    ];
  }
  return [
    { icon: LayoutDashboard, label: "Dashboard", path: "/student/dashboard", section: "Overview", tone: "emerald" },
    { icon: GraduationCap, label: "My courses", path: "/student/courses", section: "Workspace", tone: "blue" },
    { icon: LibraryBig, label: "Library", path: "/student/library", section: "Workspace", tone: "indigo" },
    { icon: BotMessageSquare, label: "Ask AI", path: "/student/askai", section: "Workspace", tone: "violet" },
    { icon: Layers, label: "Flashcards", path: "/student/flashcards", section: "Assessment", tone: "pink" },
    { icon: ListChecks, label: "Quizzes", path: "/student/quizzes", section: "Assessment", tone: "amber" },
    { icon: CalendarDays, label: "Study planner", path: "/student/planner", section: "Workspace", tone: "sky" },
    { icon: TrendingUp, label: "Progress", path: "/student/progress", section: "Assessment", tone: "teal" },
    { icon: Bell, label: "Notifications", path: "/student/notifications", section: "Account", tone: "orange" },
    { icon: UserRound, label: "Profile", path: "/profile", section: "Account", tone: "rose" },
    { icon: SettingsIcon, label: "Settings", path: "/settings", section: "Account", tone: "gray" },
  ];
};

function isPathActive(path: string, location: string) {
  if (location === path) return true;
  if (path === "/admin" || path === "/lecturer/dashboard") return false;
  return location.startsWith(`${path}/`);
}

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

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const inbox = trpc.notifications.list.useQuery(undefined, { enabled: user?.role === "user" });
  const searchCourses = trpc.studentCourses.list.useQuery(undefined, { enabled: user?.role === "user" && search.length > 1 });
  const searchDocuments = trpc.documents.list.useQuery(undefined, { enabled: user?.role === "user" && search.length > 1 });
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === "k") { event.preventDefault(); searchRef.current?.focus(); } if (event.key === "Escape") setSearch(""); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);

  const role = (user?.role ?? "user") as Role;
  const t = ROLE_THEME[role] ?? ROLE_THEME.user;
  const menuItems = getMenuItems(role);
  const activeItem = menuItems.find((item) => isPathActive(item.path, location)) ?? menuItems.find((item) => item.path === location);
  const sections = [...new Set(menuItems.map((item) => item.section))];
  useEffect(() => {
    if (role === "user") document.querySelector('.student-shell .sidebar-nav-item[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [location, role]);

  const settingsSectionMatch = location.match(/^\/admin\/settings(?:\/([^/?#]+))?/);
  const settingsSectionId = settingsSectionMatch?.[1] || (settingsSectionMatch ? "profile" : null);
  const settingsSectionLabel = settingsSectionId
    ? SETTINGS_NAV.flatMap<{ id: string; label: string }>((g) => [...g.items]).find((item) => item.id === settingsSectionId)?.label ??
      settingsSectionId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const academicSubLabel = location.startsWith("/admin/academic") ? "Assign Course" : null;
  const crumbSubLabel = settingsSectionLabel ?? academicSubLabel;

  return (
    <div className={`dashboard-shell ${role === "admin" ? "admin-shell" : role === "lecturer" ? "lecturer-shell" : "student-shell"} flex min-h-screen p-3 ${t.sidebar}`}>
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={[
        "fixed z-40 flex w-[248px] flex-col overflow-hidden rounded-[28px] border border-white/10",
        "top-3 bottom-3 left-3 transition-transform duration-300",
        "cognify-sidebar shadow-[0_18px_50px_rgba(0,20,18,0.28)]",
        t.sidebar,
        isMobile ? (mobileOpen ? "translate-x-0" : "-translate-x-[calc(100%+0.75rem)]") : "translate-x-0",
      ].join(" ")}>
        <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-400 shadow-lg shadow-emerald-950/40 ring-1 ring-white/30">
            <img src="/logo.png" alt="Course-Specific AI Learning Assistant" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold leading-[1.15] tracking-tight text-white">
              <span className="sidebar-brand-line">Course-Specific</span>
              <span className="sidebar-brand-line sidebar-brand-sub">AI Learning Assistant</span>
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
              {t.label}
            </p>
          </div>
        </div>

        <nav className="cognify-sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section} className="mb-4 last:mb-0">
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/45">
                {role === "user" && section === "Workspace" ? "Learning" : section}
              </p>
              <ul className="space-y-1">
                {menuItems.filter((item) => item.section === section).map((item) => {
                  const isActive = isPathActive(item.path, location);
                  return (
                    <li key={item.path}>
                      <button
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => { setLocation(item.path); setMobileOpen(false); }}
                        className={[
                          "sidebar-nav-item group relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-[13.5px] font-semibold",
                          "transition-all duration-200",
                          isActive
                            ? role === "admin"
                              ? "bg-[#e6faf5] text-[#033c35] shadow-[0_0_24px_rgba(52,211,153,0.35)]"
                              : "bg-white text-[#033c35] shadow-md shadow-black/10"
                            : "text-emerald-50/80 hover:bg-white/10 hover:text-white",
                        ].join(" ")}
                      >
                        {isActive && role === "admin" ? (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#34d399]"
                          />
                        ) : null}
                        <span data-tone={item.tone} className={[
                          "sidebar-nav-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                          isActive
                            ? role === "admin"
                              ? "bg-emerald-100/80 text-emerald-800"
                              : "bg-emerald-100 text-emerald-800"
                            : "bg-white/8 text-emerald-100/80 group-hover:bg-white/12 group-hover:text-white",
                        ].join(" ")}>
                          <item.icon strokeWidth={isActive ? 2.4 : 2} className="h-[16px] w-[16px]" />
                        </span>
                        <span className="flex-1 text-left leading-tight">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-2xl bg-white/8 px-2.5 py-2 ring-1 ring-white/10">
            <Avatar className="h-9 w-9 rounded-xl">
              {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" className="object-cover rounded-xl" /> : null}
              <AvatarFallback className={`rounded-xl text-xs font-bold text-white ${t.avatar}`}>
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{user?.name}</p>
              <p className="truncate text-[11px] text-emerald-100/60">{role === "admin" ? "Administrator" : role === "lecturer" ? "Lecturer" : "Student"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.replace("/login");
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-semibold text-emerald-100/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut strokeWidth={2} className="h-4 w-4 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      <div className={[
        "dashboard-workspace flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-[#f4f8f6] shadow-sm",
        isMobile ? "" : "ml-[260px]",
      ].join(" ")}>
        <header className="dashboard-topbar sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur supports-[backdrop-filter]:bg-white/85 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            {isMobile && (
              <button type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}
                className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            )}
            <nav className="dashboard-breadcrumb hidden items-center gap-1.5 text-sm text-slate-400 lg:flex">
              <span
                className="cursor-pointer font-medium text-emerald-700 transition-colors hover:text-emerald-900"
                onClick={() => setLocation(t.home)}
              >
                {t.label}
              </span>
              {activeItem && (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span
                    className={`font-semibold ${crumbSubLabel ? "cursor-pointer text-emerald-700 hover:text-emerald-900" : "text-slate-700"}`}
                    onClick={
                      settingsSectionLabel
                        ? () => setLocation("/admin/settings")
                        : academicSubLabel
                          ? () => setLocation("/admin/academic")
                          : undefined
                    }
                  >
                    {activeItem.label}
                  </span>
                </>
              )}
              {crumbSubLabel ? (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span className="font-semibold text-slate-700">{crumbSubLabel}</span>
                </>
              ) : null}
            </nav>
            <p className="truncate text-sm font-semibold text-slate-800 lg:hidden">
              {crumbSubLabel ?? activeItem?.label ?? t.label}
            </p>
            <label className={`dashboard-search relative hidden w-[min(38vw,430px)] md:block`}>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search"
                placeholder={
                  role === "admin"
                    ? "Search users, courses, documents, or operations..."
                    : role === "user" ? "Search courses, materials, quizzes, or topics..." : "Search courses, students, documents, or topics..."
                }
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50/80 pl-10 pr-14 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              {true ? (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:inline">
                  Ctrl+K
                </kbd>
              ) : null}
            {role === "user" && search.length > 1 && <div className="student-search-results">{[...(searchCourses.data || []).map(c => ({ title: c.title, href: `/course/${c.id}`, type: "Course" })), ...(searchDocuments.data || []).map(d => ({ title: d.title, href: `/document/${d.id}`, type: "Material" }))].filter(x => x.title.toLowerCase().includes(search.toLowerCase())).slice(0, 8).map(x => <button type="button" key={x.href} onClick={() => { setLocation(x.href); setSearch(""); }}>{x.title}<small>{x.type}</small></button>)}{searchCourses.isLoading || searchDocuments.isLoading ? <p>Searching...</p> : <p>Search your enrolled courses and study materials.</p>}</div>}
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" aria-label="Notifications" onClick={() => role === "user" && setLocation("/student/notifications")}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors">
              <Bell strokeWidth={2} className="h-[18px] w-[18px]" />
              {(role !== "user" || inbox.data?.some(n => !n.isRead)) && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />}
            </button>
            <button type="button" aria-label="Toggle theme" onClick={() => toggleTheme?.()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors">
              {theme === "light" ? <Moon strokeWidth={2} className="h-[18px] w-[18px]" /> : <Sun strokeWidth={2} className="h-[18px] w-[18px]" />}
            </button>
            <div className="dashboard-account flex items-center gap-2 rounded-xl border border-slate-200 bg-white pl-1.5 pr-3 py-1 shadow-sm">
              <Avatar className="h-7 w-7 rounded-lg">
                {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" className="object-cover rounded-lg" /> : null}
                <AvatarFallback className={`rounded-lg text-xs font-bold text-white ${t.avatar}`}>
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

        <main className="dashboard-page flex-1 overflow-y-auto p-5 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
