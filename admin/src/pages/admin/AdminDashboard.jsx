import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Building2, UserCog, FileText, FolderKanban, CheckCircle2, Clock, Wallet, Receipt, CalendarCheck, AlertCircle, RefreshCw, IndianRupee, ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartCard, AreaChartView, BarChartView, LineChartView, DonutChartView } from "@/components/shared/Charts";
import { ActivityFeed, DueDatesWidget } from "@/components/shared/Widgets";
import RemindersWidget from "@/components/shared/RemindersWidget";
import { Button } from "@/components/ui/button";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";
import { inr } from "@/lib/utils";

const B = "/admin";
export default function AdminDashboard() {
  const [loading, setLoading] = useState(true); const [summary, setSummary] = useState(null); const [analytics, setAnalytics] = useState(null); const [taskSummary, setTaskSummary] = useState(null); const [taskAnalytics, setTaskAnalytics] = useState(null); const navigate = useNavigate();
  const load = async () => { setLoading(true); try { const [{ data: d }, { data: a }, { data: t }, { data: ta }] = await Promise.all([api.get("/admin/dashboard"), api.get("/admin/analytics/summary"), api.get("/admin/tasks/summary"), api.get("/admin/tasks/analytics")]); setSummary(d?.data || null); setAnalytics(a?.data || null); setTaskSummary(t?.data || null); setTaskAnalytics(ta?.data || null); } catch (e) { toast.error(describeApiError(e, "Unable to load dashboard")); } finally { setLoading(false); } };
  useEffect(() => {
    load();
    const onChange = (event) => {
      const resources = event?.detail?.resources || [];
      if (resources.some((r) => ["customers", "bookings", "invoices", "payments", "agents", "services", "tasks"].includes(r))) load();
    };
    window.addEventListener("ntaxco:data-changed", onChange);
    return () => window.removeEventListener("ntaxco:data-changed", onChange);
  }, []);
  const c = summary?.cards || {}; const projects = summary?.projects || []; const charts = summary?.charts || {}; const serviceCounts = analytics?.service_counts || {}; const paymentCounts = analytics?.payment_status_counts || {}; const bookingCounts = analytics?.booking_status_counts || {};
  const cards = [{ title: "Total Customers", value: c.customers ?? 0, icon: Building2, to: `${B}/customers` }, { title: "Active Agents", value: c.active_agents ?? 0, icon: UserCog, to: `${B}/agents` }, { title: "Revenue Collected", value: inr(analytics?.invoice_financials?.paid ?? c.revenue ?? 0), icon: Wallet, to: `${B}/reports` }, { title: "Outstanding", value: inr(analytics?.invoice_financials?.balance ?? c.outstanding ?? 0), icon: AlertCircle, to: `${B}/payments` }, { title: "Invoices", value: analytics?.invoice_financials?.invoiced != null ? inr(analytics.invoice_financials.invoiced) : 0, icon: Receipt, to: `${B}/invoices` }, { title: "Collection Rate", value: `${analytics?.collection_rate ?? 0}%`, icon: IndianRupee, to: `${B}/payments` }, { title: "Bookings", value: c.bookings ?? 0, icon: CalendarCheck, to: `${B}/bookings` }, { title: "Employees", value: c.employees ?? 0, icon: Users, to: `${B}/employees` }];
  const statusData = Object.entries(bookingCounts).map(([name, value]) => ({ name, value })); const serviceData = Object.entries(serviceCounts).map(([name, value]) => ({ name, value })); const paymentData = Object.entries(paymentCounts).map(([name, value]) => ({ name, value }));
  const recentProjects = [...projects].sort((a,b) => String(b.updated_at || b.start_date || "").localeCompare(String(a.updated_at || a.start_date || ""))).slice(0, 5);
  return <div><PageHeader title="Super Admin Dashboard" subtitle="Overview of NTAXCO operations, revenue and compliance." breadcrumb={["Super Admin", "Dashboard"]} actions={<Button variant="outline" className="border-zinc-300" onClick={load}><RefreshCw className="h-4 w-4 mr-1.5" />Refresh</Button>} />
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">{cards.map((x, i) => <KpiCard key={i} {...x} loading={loading} testId={`kpi-${i}`} />)}</div>
    <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div><h2 className="font-semibold text-zinc-900">Task Management Summary</h2><p className="text-xs text-zinc-500 mt-0.5">Live status from the internal Task Board</p></div>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/task-board")}>View Task Board <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[["Total Tasks", taskSummary?.total ?? 0], ["To Do", taskSummary?.todo ?? 0], ["In Progress", taskSummary?.in_progress ?? 0], ["Review", taskSummary?.review ?? 0], ["Completed", taskSummary?.completed ?? 0], ["Unassigned", taskSummary?.unassigned ?? 0], ["Overdue", taskSummary?.overdue ?? 0]].map(([label, value]) =>
          <div key={label} className="rounded-lg bg-zinc-50 border border-zinc-100 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="text-xl font-semibold text-zinc-900 mt-1">{value}</p></div>
        )}
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6" data-testid="task-analytics">
      <ChartCard title="Tasks by Status" subtitle="Live Task Board counts"><BarChartView data={taskAnalytics?.by_status || []} xKey="name" keys={[{ key: "value", name: "Tasks" }]} /></ChartCard>
      <ChartCard title="Tasks by Service" subtitle="Tasks linked to each service"><BarChartView data={taskAnalytics?.by_service || []} xKey="name" keys={[{ key: "value", name: "Tasks" }]} /></ChartCard>
      <ChartCard title="Employee / Consultant Workload" subtitle="Open (not completed) tasks per assignee"><BarChartView data={taskAnalytics?.workload || []} xKey="name" keys={[{ key: "value", name: "Active Tasks" }]} /></ChartCard>
      <ChartCard title="Task Completion Trend" subtitle="Tasks created vs completed per month"><LineChartView data={taskAnalytics?.trend || []} xKey="m" keys={[{ key: "created", name: "Created" }, { key: "completed", name: "Completed" }]} /></ChartCard>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"><ChartCard title="Monthly Revenue" testId="chart-revenue"><AreaChartView data={charts.revenue_monthly || []} xKey="m" keys={[{ key: "revenue", name: "Revenue" }]} /></ChartCard><ChartCard title="Service-wise Invoice Counts"><DonutChartView data={serviceData} /></ChartCard><ChartCard title="Payment Status"><DonutChartView data={paymentData} /></ChartCard></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"><ChartCard title="Booking Status"><DonutChartView data={statusData} /></ChartCard><ChartCard title="Customer Growth"><BarChartView data={charts.customer_growth || []} xKey="m" keys={[{ key: "customers", name: "New Customers" }]} /></ChartCard></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"><ChartCard title="GST vs Income Tax Filing Trend"><LineChartView data={charts.filing_trend || []} xKey="m" keys={[{ key: "gst", name: "GST" }, { key: "itr", name: "ITR" }]} /></ChartCard><ChartCard title="Employee Performance"><BarChartView data={charts.performance || []} xKey="name" keys={[{ key: "score", name: "Score" }]} /></ChartCard></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"><ActivityFeed items={recentProjects.map(p => ({ title: `${p.name} — ${p.status}`, time: p.due_date ? `Due ${p.due_date}` : "Active", tag: p.service_type || "Project" }))} /><DueDatesWidget items={projects.filter(p => p.due_date).slice(0, 6).map(p => ({ title: p.name, date: p.due_date, type: p.service_type || "Project" }))} /></div><RemindersWidget />
  </div>;
}
