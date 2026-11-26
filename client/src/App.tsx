import { lazy, Suspense } from "react";
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
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminAcademic = lazy(() => import("./pages/AdminAcademic"));
const AdminOperations = lazy(() => import("./pages/AdminOperations"));
const AdminAudit = lazy(() => import("./pages/AdminAudit"));
const AdminCommunications = lazy(() => import("./pages/AdminCommunications"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const LecturerDashboard = lazy(() => import("./pages/lecturer/LecturerDashboard"));
const LecturerCourses = lazy(() => import("./pages/lecturer/LecturerCourses"));
const LecturerCourseDetail = lazy(() => import("./pages/lecturer/LecturerCourseDetail"));
const LecturerStudents = lazy(() => import("./pages/lecturer/LecturerStudents"));
const LecturerAnalytics = lazy(() => import("./pages/lecturer/LecturerAnalytics"));
const LecturerAnnouncements = lazy(() => import("./pages/lecturer/LecturerAnnouncements"));
const LecturerReports = lazy(() => import("./pages/lecturer/LecturerReports"));
const LecturerAssessments = lazy(() => import("./pages/lecturer/LecturerAssessments"));

import { LoadingIndicator } from "./components/ui/spinner";
const StudentPortal = lazy(() => import("./pages/student/StudentPortal"));

function Router() {
  return (
    <Suspense
      fallback={
        <LoadingIndicator label="Loading workspace..." className="min-h-screen" />
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
