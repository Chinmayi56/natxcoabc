import {
  LayoutDashboard, Users, Building2, UserCog, FolderKanban, CalendarCheck,
  FileText, Receipt, Wallet, ShieldCheck, BadgeIndianRupee, BookOpen,
  Bell, FolderOpen, BarChart3, CalendarDays, ClipboardList, UserPlus,
  Handshake, Target, TrendingUp, Clock, PlaneTakeoff, MessageSquare,
  LifeBuoy, Settings, Briefcase, FileCheck2, Landmark, ScrollText, Home, Calculator,
} from "lucide-react";

export const ROLES = {
  admin: { label: "Super Admin", base: "/admin", color: "#FFB800", tagline: "Full control over the NTAXCO ERP" },
  employee: { label: "Employee", base: "/employee", color: "#18181B", tagline: "Your workspace & assigned clients" },
  customer: { label: "Customer", base: "/customer", color: "#F59E0B", tagline: "Manage your tax & compliance" },
  agent: { label: "Tax Consultant", base: "/agent", color: "#D97706", tagline: "Leads, clients & consulting" },
};

// All four portals support the SAME two login methods: Email + Password
// and Mobile + OTP.
export const LOGIN_METHODS = {
  admin: "both",
  employee: "both",
  customer: "both",
  agent: "both",
};

// Customer lands on the Home page after login; other roles go to their dashboard.
export const landingPath = (role) => (role === "customer" ? "/customer" : `${ROLES[role]?.base || "/"}/dashboard`);

export const NAV = {
  admin: [
    { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Employees", path: "/admin/employees", icon: Users },
    { label: "Leave Requests", path: "/admin/leave-requests", icon: PlaneTakeoff },
    { label: "Customers", path: "/admin/customers", icon: Building2 },
    { label: "Agents", path: "/admin/agents", icon: UserCog },
    { label: "Bookings", path: "/admin/bookings", icon: CalendarCheck },
    { label: "Projects", path: "/admin/projects", icon: FolderKanban },
    { label: "GST", path: "/admin/gst", icon: FileText },
    { label: "Income Tax", path: "/admin/income-tax", icon: BadgeIndianRupee },
    { label: "TDS", path: "/admin/tds", icon: FileCheck2 },
    { label: "ROC", path: "/admin/roc", icon: ScrollText },
    { label: "Accounting", path: "/admin/accounting", icon: BookOpen },
    { label: "Invoices", path: "/admin/invoices", icon: Receipt },
    { label: "Payments", path: "/admin/payments", icon: Wallet },
    { label: "Documents", path: "/admin/documents", icon: FolderOpen },
    { label: "Reports", path: "/admin/reports", icon: BarChart3 },
    { label: "Notifications", path: "/admin/notifications", icon: Bell },
    { label: "Security Overview", path: "/admin/security/overview", icon: ShieldCheck },
    { label: "Login Activity", path: "/admin/security/login-activity", icon: ClipboardList },
    { label: "Active Sessions", path: "/admin/security/sessions", icon: Landmark },
    { label: "Settings", path: "/admin/settings", icon: Settings },
  ],
  employee: [
    { label: "Dashboard", path: "/employee/dashboard", icon: LayoutDashboard },
    { label: "Attendance", path: "/employee/attendance", icon: Clock },
    { label: "Leave", path: "/employee/leave", icon: PlaneTakeoff },
    { label: "Tasks", path: "/employee/tasks", icon: ClipboardList },
    { label: "Projects", path: "/employee/projects", icon: FolderKanban },
    { label: "Customers", path: "/employee/customers", icon: Building2 },
    { label: "Calendar", path: "/employee/calendar", icon: CalendarDays },
    { label: "Meetings", path: "/employee/meetings", icon: CalendarCheck },
    { label: "Documents", path: "/employee/documents", icon: FolderOpen },
    { label: "Payslips", path: "/employee/payslips", icon: Receipt },
    { label: "Performance", path: "/employee/performance", icon: TrendingUp },
    { label: "Notifications", path: "/employee/notifications", icon: Bell },
    { label: "Profile", path: "/employee/profile", icon: UserCog },
  ],
  customer: [
    { label: "Home", path: "/customer", icon: Home, end: true },
    { label: "Dashboard", path: "/customer/dashboard", icon: LayoutDashboard },
    { label: "GST Returns", path: "/customer/gst", icon: FileText },
    { label: "Income Tax", path: "/customer/income-tax", icon: BadgeIndianRupee },
    { label: "TDS", path: "/customer/tds", icon: FileCheck2 },
    { label: "Projects", path: "/customer/projects", icon: FolderKanban },
    { label: "My Services", path: "/customer/bookings", icon: CalendarCheck },
    { label: "Invoices", path: "/customer/invoices", icon: Receipt },
    { label: "Documents", path: "/customer/documents", icon: FolderOpen },
    { label: "Support", path: "/customer/support", icon: LifeBuoy },
    { label: "Messages", path: "/customer/messages", icon: MessageSquare },
    { label: "Reports", path: "/customer/reports", icon: BarChart3 },
    { label: "Calculator", path: "/customer/calculator", icon: Calculator },
    { label: "Profile", path: "/customer/profile", icon: Building2 },
  ],
  agent: [
    { label: "Dashboard", path: "/agent/dashboard", icon: LayoutDashboard },
    { label: "Leads", path: "/agent/leads", icon: Target },
    { label: "Onboarding", path: "/agent/onboarding", icon: UserPlus },
    { label: "Customers", path: "/agent/customers", icon: Building2 },
    { label: "Bookings", path: "/agent/bookings", icon: CalendarCheck },
    { label: "Appointments", path: "/agent/appointments", icon: CalendarCheck },
    { label: "Meetings", path: "/agent/meetings", icon: Handshake },
    { label: "Calendar", path: "/agent/calendar", icon: CalendarDays },
    { label: "Projects", path: "/agent/projects", icon: FolderKanban },
    { label: "Commission", path: "/agent/commission", icon: Landmark },
    { label: "Performance", path: "/agent/performance", icon: TrendingUp },
    { label: "Reports", path: "/agent/reports", icon: BarChart3 },
    { label: "Documents", path: "/agent/documents", icon: FolderOpen },
    { label: "Notifications", path: "/agent/notifications", icon: Bell },
    { label: "Profile", path: "/agent/profile", icon: Briefcase },
  ],
};

// Bundled locally so the login/branding screens never depend on an external CDN.
export const LOGO_URL = "/ntaxco-logo.jpg";

export const WHATSAPP = {
  number: "919876543210",
  message: "Hello NTAXCO Team,\nI would like assistance regarding your tax and compliance services.\nPlease contact me.\nThank you.",
  hours: "Mon – Sat, 9:00 AM – 7:00 PM",
  responseTime: "Usually replies within 5 minutes",
  company: "NTAXCO",
  email: "support@ntaxco.com",
  phone: "+91 98765 43210",
};
