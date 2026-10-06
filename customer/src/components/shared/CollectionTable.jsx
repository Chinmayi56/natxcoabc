import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { inr } from "@/lib/utils";
import { FolderKanban, CheckCircle2, Clock, Building2, CalendarCheck, Users, Wallet, FolderOpen, UserCog, Star, XCircle, Download, Eye, IndianRupee } from "lucide-react";

const bar = (v) => (
  <div className="flex items-center gap-2 min-w-[110px]"><Progress value={v} className="h-2 bg-zinc-100 [&>div]:bg-brand" /><span className="text-xs w-9 text-right">{v}%</span></div>
);

const docActions = {
  key: "actions", label: "Actions", render: (r) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className="h-8 text-royal" onClick={() => toast.info(`Preview: ${r.name}`)} data-testid={`doc-view-${r.id}`}><Eye className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" className="h-8 text-brand-hover" onClick={() => toast.success(`Downloading ${r.name}`)} data-testid={`doc-dl-${r.id}`}><Download className="h-4 w-4" /></Button>
    </div>
  ),
};

const DOC_COLUMNS = [
  { key: "name", label: "File Name" },
  { key: "client_name", label: "Client" },
  { key: "category", label: "Category" },
  { key: "type", label: "Type" },
  { key: "size", label: "Size" },
  { key: "uploaded_by", label: "Uploaded By" },
  { key: "uploaded_date", label: "Date" },
  { key: "version", label: "Ver" },
  { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  docActions,
];
const DOC_KPI = (r) => [
  { title: "Total Documents", value: r.length, icon: FolderOpen },
  { title: "Approved", value: r.filter((x) => x.status === "Approved").length, icon: CheckCircle2 },
  { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
  { title: "Rejected", value: r.filter((x) => x.status === "Rejected").length, icon: XCircle },
];

const PRESETS = {
  "admin-payments": {
    name: "payments", title: "Payments", breadcrumb: ["Super Admin", "Payments"],
    kpiFn: (r) => [
      { title: "Total Revenue", value: inr(r.filter((x) => x.status === "Completed").reduce((s, x) => s + (x.total || 0), 0)), icon: IndianRupee },
      { title: "Completed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 },
      { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
      { title: "Failed", value: r.filter((x) => x.status === "Failed").length, icon: XCircle },
    ],
    columns: [
      { key: "payment_id", label: "Payment ID" }, { key: "customer", label: "Customer" }, { key: "invoice_no", label: "Invoice" },
      { key: "total", label: "Amount", render: (r) => inr(r.total), exportValue: (r) => r.total },
      { key: "gst", label: "GST", render: (r) => inr(r.gst), exportValue: (r) => r.gst },
      { key: "mode", label: "Mode" }, { key: "reference_no", label: "Reference" }, { key: "txn_date", label: "Date" },
      { key: "agent", label: "Agent" }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
  },
  "admin-agents": {
    name: "agents", title: "Agent Management", breadcrumb: ["Super Admin", "Agents"],
    kpiFn: (r) => [
      { title: "Total Consultants", value: r.length, icon: UserCog },
      { title: "Active", value: r.filter((x) => x.status === "Active").length, icon: CheckCircle2 },
      { title: "Active Clients", value: r.reduce((s, x) => s + (x.active_clients || 0), 0), icon: Users },
      { title: "Commission YTD", value: inr(r.reduce((s, x) => s + (x.commission_ytd || 0), 0)), icon: Wallet },
    ],
    columns: [
      { key: "agent_id", label: "ID" }, { key: "name", label: "Name" }, { key: "mobile", label: "Mobile" },
      { key: "specialization", label: "Specialization" }, { key: "experience", label: "Exp" }, { key: "region", label: "Region" },
      { key: "active_clients", label: "Clients" },
      { key: "conversion", label: "Conv %", render: (r) => `${r.conversion}%` },
      { key: "rating", label: "Rating", render: (r) => <span className="inline-flex items-center gap-1">{r.rating} <Star className="h-3 w-3 text-brand fill-brand" /></span> },
      { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
  },
  "admin-documents": { name: "documents", title: "Documents", breadcrumb: ["Super Admin", "Documents"], kpiFn: DOC_KPI, columns: DOC_COLUMNS },
  "emp-documents": { name: "documents", title: "Documents", breadcrumb: ["Employee", "Documents"], kpiFn: DOC_KPI, columns: DOC_COLUMNS },
  "agent-documents": { name: "documents", title: "Documents", breadcrumb: ["Tax Consultant", "Documents"], kpiFn: DOC_KPI, columns: DOC_COLUMNS },
  "agent-projects": {
    name: "projects", title: "My Projects", breadcrumb: ["Tax Consultant", "Projects"],
    kpiFn: (r) => [
      { title: "Total", value: r.length, icon: FolderKanban },
      { title: "Completed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 },
      { title: "Running", value: r.filter((x) => x.status === "Running").length, icon: Clock },
      { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
    ],
    columns: [
      { key: "project_id", label: "ID" }, { key: "name", label: "Project" }, { key: "client", label: "Client" },
      { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} /> },
      { key: "progress", label: "Progress", render: (r) => bar(r.progress) },
      { key: "due_date", label: "Due" }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
  },
  "emp-projects": {
    name: "projects", title: "My Projects", breadcrumb: ["Employee", "Projects"],
    kpiFn: (r) => [
      { title: "Total", value: r.length, icon: FolderKanban },
      { title: "Completed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 },
      { title: "Running", value: r.filter((x) => x.status === "Running").length, icon: Clock },
      { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
    ],
    columns: [
      { key: "project_id", label: "ID" }, { key: "name", label: "Project" }, { key: "client", label: "Client" },
      { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} /> },
      { key: "progress", label: "Progress", render: (r) => bar(r.progress) },
      { key: "due_date", label: "Due" }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
  },
  "emp-customers": {
    name: "customers", title: "Assigned Customers", breadcrumb: ["Employee", "Customers"],
    kpiFn: (r) => [{ title: "Customers", value: r.length, icon: Building2 }, { title: "Active", value: r.filter((x) => x.status === "Active").length, icon: CheckCircle2 }, { title: "Outstanding", value: inr(r.reduce((s, x) => s + (x.outstanding || 0), 0)), icon: Clock }],
    columns: [
      { key: "business_name", label: "Business" }, { key: "gst_number", label: "GSTIN" }, { key: "pan", label: "PAN" },
      { key: "mobile", label: "Mobile" }, { key: "state", label: "State" },
      { key: "outstanding", label: "Outstanding", render: (r) => inr(r.outstanding), exportValue: (r) => r.outstanding },
      { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
  },
  "agent-customers": {
    name: "customers", title: "My Customers", breadcrumb: ["Tax Consultant", "Customers"],
    kpiFn: (r) => [{ title: "Customers", value: r.length, icon: Building2 }, { title: "Active", value: r.filter((x) => x.status === "Active").length, icon: CheckCircle2 }],
    columns: [
      { key: "business_name", label: "Business" }, { key: "owner", label: "Contact" }, { key: "gst_number", label: "GSTIN" },
      { key: "mobile", label: "Mobile" }, { key: "state", label: "State" }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
  },
  "emp-meetings": {
    name: "appointments", title: "Meetings", breadcrumb: ["Employee", "Meetings"],
    kpiFn: (r) => [{ title: "Total", value: r.length, icon: CalendarCheck }, { title: "Upcoming", value: r.filter((x) => x.status === "Upcoming").length, icon: Clock }, { title: "Completed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 }],
    columns: [
      { key: "business_name", label: "Client" }, { key: "date", label: "Date" }, { key: "time", label: "Time" },
      { key: "service", label: "Agenda" }, { key: "mode", label: "Mode" }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
  },
  "agent-meetings": {
    name: "appointments", title: "Meetings", breadcrumb: ["Tax Consultant", "Meetings"],
    kpiFn: (r) => [{ title: "Total", value: r.length, icon: CalendarCheck }, { title: "Upcoming", value: r.filter((x) => x.status === "Upcoming").length, icon: Clock }, { title: "Completed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 }],
    columns: [
      { key: "business_name", label: "Client" }, { key: "date", label: "Date" }, { key: "time", label: "Time" },
      { key: "service", label: "Service" }, { key: "mode", label: "Mode" }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    ],
  },
};

export default function CollectionTable({ preset }) {
  const cfg = PRESETS[preset];
  const { rows, loading } = useCrud(cfg.name);
  const kpis = cfg.kpiFn ? cfg.kpiFn(rows) : null;
  return (
    <div>
      <PageHeader title={cfg.title} breadcrumb={cfg.breadcrumb} subtitle={`${cfg.title} — live data from the shared NTAXCO backend.`} />
      {kpis && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{kpis.map((k, i) => <KpiCard key={i} {...k} loading={loading} testId={`kpi-${i}`} />)}</div>}
      <DataTable title={cfg.title} columns={cfg.columns} rows={rows} loading={loading} pageSize={8} testId={`${preset}-table`} />
    </div>
  );
}
