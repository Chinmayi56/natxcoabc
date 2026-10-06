import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute, PublicRoute } from "@/routes/guards";
import PortalLayout from "@/components/layout/PortalLayout";
import NotFound from "@/pages/NotFound";
import LoginPage from "@/pages/auth/LoginPage";
import ModulePlaceholder from "@/pages/ModulePlaceholder";
import NotificationsPage from "@/components/shared/NotificationsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import AdminProfile from "@/pages/admin/AdminProfile";
import AgentBookings from "@/pages/agent/AgentBookings";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import EmployeeDashboard from "@/pages/employee/EmployeeDashboard";
import AgentDashboard from "@/pages/agent/AgentDashboard";
import EmployeeManagement from "@/pages/admin/EmployeeManagement";
import AdminLeaveRequests from "@/pages/admin/AdminLeaveRequests";
import CustomerManagement from "@/pages/admin/CustomerManagement";
import AgentManagement from "@/pages/admin/AgentManagement";
import PaymentDashboard from "@/pages/admin/PaymentDashboard";
import Bookings from "@/pages/admin/Bookings";
import Projects from "@/pages/admin/Projects";
import Services from "@/pages/admin/Services";
import Invoices from "@/pages/admin/Invoices";
import GstModule from "@/pages/admin/GstModule";
import IncomeTaxModule from "@/pages/admin/IncomeTaxModule";
import TdsModule from "@/pages/admin/TdsModule";
import RocModule from "@/pages/admin/RocModule";
import AccountingDashboard from "@/pages/admin/AccountingDashboard";
import Reports from "@/pages/admin/Reports";
import TaskBoard from "@/pages/admin/TaskBoard";
import SecurityOverview from "@/pages/admin/security/SecurityOverview";
import LoginActivity from "@/pages/admin/security/LoginActivity";
import ActiveSessions from "@/pages/admin/security/ActiveSessions";
import Attendance from "@/pages/employee/Attendance";
import Leave from "@/pages/employee/Leave";
import Tasks from "@/pages/employee/Tasks";
import Payslips from "@/pages/employee/Payslips";
import Leads from "@/pages/agent/Leads";
import Onboarding from "@/pages/agent/Onboarding";
import Appointments from "@/pages/agent/Appointments";
import Commission from "@/pages/agent/Commission";
import CollectionTable from "@/components/shared/CollectionTable";
import CalendarView from "@/components/shared/CalendarView";
import DynamicModulePage from "@/pages/admin/DynamicModulePage";
import PerformancePage from "@/components/shared/PerformancePage";
import ProfilePage from "@/components/shared/ProfilePage";
import RemindersWidget from "@/components/shared/RemindersWidget";
// Customer portal
import { NAV } from "@/lib/constants";

const DASHBOARDS = { admin: <AdminDashboard />, employee: <EmployeeDashboard />, agent: <AgentDashboard /> };

const ADMIN_MODULES = {
  employees: <EmployeeManagement />,
  "leave-requests": <AdminLeaveRequests />,
  customers: <CustomerManagement />,
  bookings: <Bookings />,
  projects: <Projects />,
  services: <Services />,
  invoices: <Invoices />,
  gst: <GstModule />,
  "income-tax": <IncomeTaxModule />,
  tds: <TdsModule />,
  roc: <RocModule />,
  accounting: <AccountingDashboard />,
  reports: <Reports />,
  "task-board": <TaskBoard />,
  agents: <AgentManagement />,
  payments: <PaymentDashboard />,
  documents: <CollectionTable preset="admin-documents" />,
  notifications: <NotificationsPage base="/admin" portal="Super Admin" />,
  "security/overview": <SecurityOverview />,
  "security/login-activity": <LoginActivity />,
  "security/sessions": <ActiveSessions />,
  "admin-profile": <AdminProfile />,
  settings: <SettingsPage />,
};

const EMPLOYEE_MODULES = {
  attendance: <Attendance />,
  leave: <Leave />,
  tasks: <Tasks />,
  payslips: <Payslips />,
  projects: <CollectionTable preset="emp-projects" />,
  customers: <CollectionTable preset="emp-customers" />,
  calendar: <CalendarView role="employee" />,
  meetings: <CollectionTable preset="emp-meetings" />,
  documents: <CollectionTable preset="emp-documents" />,
  notifications: <NotificationsPage base="/employee" portal="Employee" />,
  performance: <PerformancePage role="employee" />,
  profile: <ProfilePage role="employee" />,
};

const AGENT_MODULES = {
  leads: <Leads />,
  onboarding: <Onboarding />,
  appointments: <Appointments />,
  commission: <Commission />,
  customers: <CollectionTable preset="agent-customers" />,
  bookings: <AgentBookings />,
  calendar: <CalendarView role="agent" />,
  meetings: <CollectionTable preset="agent-meetings" />,
  projects: <CollectionTable preset="agent-projects" />,
  documents: <CollectionTable preset="agent-documents" />,
  notifications: <NotificationsPage base="/agent" portal="Tax Consultant" />,
  performance: <PerformancePage role="agent" />,
  reports: <Reports />,
  "task-board": <TaskBoard />,
  profile: <ProfilePage role="agent" />,
};

function PortalRoutes({ role, overrides = {}, dynamicElement = null }) {
  const items = NAV[role] || [];
  return (
    <Route path={`/${role}`} element={<ProtectedRoute role={role}><PortalLayout role={role} /></ProtectedRoute>}>
      <Route index element={<Navigate to={`/${role}/dashboard`} replace />} />
      <Route path="dashboard" element={DASHBOARDS[role]} />
      {items.filter((it) => !it.path.endsWith("/dashboard")).map((it) => {
        // Use the path relative to the portal base (not just the last
        // segment) so multi-segment routes like /admin/security/overview
        // nest correctly instead of colliding at /admin/overview.
        const seg = it.path.replace(`/${role}/`, "");
        return <Route key={it.path} path={seg} element={overrides[seg] || <ModulePlaceholder role={role} title={it.label} />} />;
      })}
      {/* Admin-created dynamic modules (Settings → Modules / Dynamic
          Configuration) live at a single-segment slug, e.g. /admin/client-feedback.
          React Router ranks static segments (the routes above) higher than this
          ":moduleSlug" param, so it only ever catches slugs that aren't already
          a real route — and it resolves the module by slug on every load, so
          direct navigation/refresh always works without depending on the
          sidebar having loaded first. */}
      {dynamicElement && <Route path=":moduleSlug" element={dynamicElement} />}
      <Route path="*" element={<NotFound />} />
    </Route>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="bottom-right" richColors closeButton />

      <BrowserRouter>
        <Routes>

          {/* Login / Portal selection */}
          <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/login/:role" element={<PublicRoute><LoginPage /></PublicRoute>} />

          {/* Admin Portal */}
          {PortalRoutes({
            role: "admin",
            overrides: ADMIN_MODULES,
            dynamicElement: <DynamicModulePage />,
          })}

          {/* Employee Portal */}
          {PortalRoutes({
            role: "employee",
            overrides: EMPLOYEE_MODULES,
          })}

          {/* Agent Portal */}
          {PortalRoutes({
            role: "agent",
            overrides: AGENT_MODULES,
          })}

          {/* 404 */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}