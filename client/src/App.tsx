import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminAcademic from "./pages/AdminAcademic";
import AdminOperations from "./pages/AdminOperations";
import AdminAudit from "./pages/AdminAudit";
import AdminCommunications from "./pages/AdminCommunications";
import AdminSettings from "./pages/AdminSettings";
import LecturerDashboard from "./pages/lecturer/LecturerDashboard";
import LecturerCourses from "./pages/lecturer/LecturerCourses";
import LecturerCourseDetail from "./pages/lecturer/LecturerCourseDetail";
import LecturerStudents from "./pages/lecturer/LecturerStudents";
import LecturerAnalytics from "./pages/lecturer/LecturerAnalytics";
import LecturerAnnouncements from "./pages/lecturer/LecturerAnnouncements";
import LecturerReports from "./pages/lecturer/LecturerReports";
import LecturerAssessments from "./pages/lecturer/LecturerAssessments";
import { lazy, Suspense } from "react";
const StudentPortal = lazy(() => import("./pages/student/StudentPortal"));

function Router() {
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Loading workspace...
        </p>
      }
    >
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/lecturer/signup"><Redirect to="/login" /></Route>
        <Route path="/signup"><Redirect to="/login" /></Route>
        <Route path="/student-blocked" component={StudentPortal} />
        <Route path="/student/:page" component={StudentPortal} />
        <Route path="/course/:id" component={StudentPortal} />
        <Route path="/document/:id" component={StudentPortal} />
        <Route path="/exam/:id" component={StudentPortal} />
        <Route path="/discussion/:id" component={StudentPortal} />
        {/* Lecturer */}
        <Route path="/lecturer/dashboard" component={LecturerDashboard} />
        <Route path="/lecturer/courses" component={LecturerCourses} />
        <Route path="/lecturer/courses/:id" component={LecturerCourseDetail} />
        <Route path="/lecturer/students" component={LecturerStudents} />
        <Route path="/lecturer/analytics" component={LecturerAnalytics} />
        <Route
          path="/lecturer/announcements"
          component={LecturerAnnouncements}
        />
        <Route path="/lecturer/reports" component={LecturerReports} />
        <Route path="/lecturer/assessments" component={LecturerAssessments} />
        {/* Admin */}
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/academic" component={AdminAcademic} />
        <Route path="/admin/operations" component={AdminOperations} />
        <Route path="/admin/audit" component={AdminAudit} />
        <Route path="/admin/communications" component={AdminCommunications} />
        <Route path="/admin/settings/:section" component={AdminSettings} />
        <Route path="/admin/settings" component={AdminSettings} />
        {/* Shared account pages */}
        <Route path={"/profile"} component={Profile} />
        <Route path={"/settings"} component={Settings} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
