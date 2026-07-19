import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { PageLoader } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";

const Login = lazy(() => import("./pages/Login"));
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const MarkAttendance = lazy(() => import("./pages/student/MarkAttendance"));
const AttendanceHistory = lazy(() => import("./pages/student/AttendanceHistory"));
const StudentProfile = lazy(() => import("./pages/student/Profile"));
const StudentNotifications = lazy(() => import("./pages/student/Notifications"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const StudentManagement = lazy(() => import("./pages/admin/StudentManagement"));
const QrManagement = lazy(() => import("./pages/admin/QrManagement"));
const GeofenceManagement = lazy(() => import("./pages/admin/GeofenceManagement"));
const AttendanceManagement = lazy(() => import("./pages/admin/AttendanceManagement"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const Defaulters = lazy(() => import("./pages/admin/Defaulters"));
const AdminNotifications = lazy(() => import("./pages/admin/Notifications"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));

function StudentRoute({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (role !== "student") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { role, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (role === "student") return <Navigate to="/student" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  return <Login />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/student" element={<StudentRoute><StudentDashboard /></StudentRoute>} />
            <Route path="/student/mark" element={<StudentRoute><MarkAttendance /></StudentRoute>} />
            <Route path="/student/history" element={<StudentRoute><AttendanceHistory /></StudentRoute>} />
            <Route path="/student/profile" element={<StudentRoute><StudentProfile /></StudentRoute>} />
            <Route path="/student/notifications" element={<StudentRoute><StudentNotifications /></StudentRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/students" element={<AdminRoute><StudentManagement /></AdminRoute>} />
            <Route path="/admin/qr" element={<AdminRoute><QrManagement /></AdminRoute>} />
            <Route path="/admin/geofence" element={<AdminRoute><GeofenceManagement /></AdminRoute>} />
            <Route path="/admin/attendance" element={<AdminRoute><AttendanceManagement /></AdminRoute>} />
            <Route path="/admin/reports" element={<AdminRoute><Reports /></AdminRoute>} />
            <Route path="/admin/defaulters" element={<AdminRoute><Defaulters /></AdminRoute>} />
            <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            <Route path="/admin/audit" element={<AdminRoute><AuditLogs /></AdminRoute>} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
