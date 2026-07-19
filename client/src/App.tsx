import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DocumentsLibrary from "./pages/DocumentsLibrary";
import DocumentDetail from "./pages/DocumentDetail";
import UploadDocument from "./pages/UploadDocument";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import FlashcardsLibrary from "./pages/FlashcardsLibrary";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminContent from "./pages/AdminContent";
import LecturerSignup from "./pages/lecturer/LecturerSignup";
import LecturerDashboard from "./pages/lecturer/LecturerDashboard";
import LecturerCourses from "./pages/lecturer/LecturerCourses";
import LecturerCourseDetail from "./pages/lecturer/LecturerCourseDetail";
import LecturerStudents from "./pages/lecturer/LecturerStudents";
import LecturerAnalytics from "./pages/lecturer/LecturerAnalytics";
import LecturerAnnouncements from "./pages/lecturer/LecturerAnnouncements";
import LecturerReports from "./pages/lecturer/LecturerReports";
import StudentBlocked from "./pages/StudentBlocked";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";

// PUBLIC_PATHS don't need a role check
// (kept for potential future use e.g. analytics)
const _PUBLIC_PATHS = ["/", "/login", "/lecturer/signup", "/404"];

/**
 * Redirects a logged-in student to /student-blocked.
 * All other users (admin, lecturer, unauthenticated) pass through.
 */
function StudentGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role !== "user") return;
    // Students are not allowed anywhere on the web except the blocked page
    if (location !== "/student-blocked") {
      setLocation("/student-blocked");
    }
  }, [user, loading, location, setLocation]);

  return <>{children}</>;
}

function Router() {
  return (
    <StudentGuard>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={Login} />
        <Route path="/lecturer/signup" component={LecturerSignup} />
        <Route path="/student-blocked" component={StudentBlocked} />        {/* Lecturer */}
        <Route path="/lecturer/dashboard" component={LecturerDashboard} />
        <Route path="/lecturer/courses" component={LecturerCourses} />
        <Route path="/lecturer/courses/:id" component={LecturerCourseDetail} />
        <Route path="/lecturer/students" component={LecturerStudents} />
        <Route path="/lecturer/analytics" component={LecturerAnalytics} />
        <Route path="/lecturer/announcements" component={LecturerAnnouncements} />
        <Route path="/lecturer/reports" component={LecturerReports} />
        {/* Admin */}
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/content" component={AdminContent} />
        {/* Shared staff pages */}
        <Route path={"/documents"} component={DocumentsLibrary} />
        <Route path={"/flashcards"} component={FlashcardsLibrary} />
        <Route path={"/document/:id"} component={DocumentDetail} />
        <Route path={"/upload"} component={UploadDocument} />
        <Route path={"/progress"} component={Progress} />
        <Route path={"/profile"} component={Profile} />
        <Route path={"/settings"} component={Settings} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </StudentGuard>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
