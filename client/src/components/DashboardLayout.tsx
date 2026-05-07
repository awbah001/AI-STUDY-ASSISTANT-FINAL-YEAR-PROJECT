import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  BookOpen,
  Bell,
  User,
  Users,
  Layers,
  
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  FileText,
  TrendingUp,
  Sun,
  Moon,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

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
  return [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: BookOpen, label: "Documents", path: "/documents" },
    { icon: Layers, label: "Flashcards", path: "/flashcards" },
    { icon: TrendingUp, label: "Progress", path: "/progress" },
    { icon: User, label: "Profile", path: "/profile" },
    { icon: SettingsIcon, label: "Settings", path: "/settings" },
  ];
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full rounded-2xl shadow-lg shadow-emerald-600/25 transition-all hover:shadow-xl"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = getMenuItems(user?.role).find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="animate-gradient-x border-r-0"
          disableTransition={isResizing}
        >
            <SidebarHeader className="h-16 justify-center border-b border-emerald-100/50">
              <div className="flex items-center gap-3 px-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center rounded-2xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 hover:bg-emerald-500/10"
                aria-label="Toggle navigation"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/5 group-hover:bg-emerald-500/15 transition-all">
                  <PanelLeft strokeWidth={2.5} className="h-[18px] w-[18px] text-emerald-700/70" />
                </div>
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-full overflow-hidden bg-emerald-600 grid place-items-center shrink-0 shadow-md shadow-emerald-600/20">
                  <img src="/logo.png" alt="Cognify Logo" className="h-full w-full object-cover" />
                </div>
                {!isCollapsed ? (
                  <span className="font-bold tracking-tight truncate text-emerald-950">
                    Cognify
                  </span>
                ) : null}
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-3 py-3">
              {getMenuItems(user?.role).map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={[
                        "group h-11 rounded-2xl px-3 text-[14px] font-semibold transition-all group-data-[collapsible=icon]:justify-center",
                        "hover:bg-emerald-500/10 hover:text-emerald-900",
                        isActive 
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30" 
                          : "text-emerald-800",
                      ].join(" ")}
                    >
                      <div className={[
                        "flex h-8 w-8 items-center justify-center rounded-2xl transition-all shrink-0",
                        isActive 
                          ? "bg-white/20 shadow-inner" 
                          : "bg-emerald-500/5 group-hover:bg-emerald-500/15"
                      ].join(" ")}>
                        <item.icon
                          strokeWidth={2.5}
                          className={[
                            "h-[18px] w-[18px] transition-all",
                            isActive 
                              ? "text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" 
                              : "text-emerald-600 group-hover:text-emerald-800",
                          ].join(" ")}
                        />
                      </div>
                      <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <button
              onClick={async () => {
                await logout();
                setLocation("/login");
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-semibold text-emerald-800 hover:bg-emerald-500/10 hover:text-emerald-950 transition-colors group-data-[collapsible=icon]:justify-center"
              type="button"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/5 group-hover:bg-emerald-500/15 transition-all">
                <LogOut strokeWidth={2.5} className="h-[18px] w-[18px] text-emerald-700 group-hover:text-emerald-900 shrink-0" />
              </div>
              <span className="truncate group-data-[collapsible=icon]:hidden">Logout</span>
            </button>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Top header (desktop + mobile) */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {isMobile ? (
                <SidebarTrigger className="h-9 w-9 rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50" />
              ) : null}

              <div className="text-sm text-slate-500 truncate">
                {activeMenuItem?.label ?? "Dashboard"}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                className="relative h-9 w-9 rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors"
                aria-label="Notifications"
                type="button"
              >
                <Bell strokeWidth={2.5} className="mx-auto h-[18px] w-[18px] text-slate-500" />
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </button>

              <button
                className="relative h-9 w-9 rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors"
                aria-label="Toggle theme"
                type="button"
                onClick={() => toggleTheme?.()}
              >
                {theme === "light" ? (
                  <Moon strokeWidth={2.5} className="mx-auto h-[18px] w-[18px] text-slate-500" />
                ) : (
                  <Sun strokeWidth={2.5} className="mx-auto h-[18px] w-[18px] text-slate-400" />
                )}
              </button>

              <div className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 shadow-sm transition-all hover:shadow-md">
                <Avatar className="h-8 w-8 border border-emerald-100">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt="" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-xs font-medium bg-emerald-500 text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block min-w-0 max-w-[200px]">
                  <div className="text-sm font-semibold leading-none truncate text-slate-900">
                    {user?.name || "-"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 truncate">
                    {user?.email || "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-gradient-to-b from-slate-50 via-white to-emerald-50/20 p-6 sm:p-8 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/10">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
