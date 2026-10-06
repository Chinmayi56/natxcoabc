import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/utils";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";
import RelationshipPanel from "@/components/shared/RelationshipPanel";
import { Wallet, Users, Clock, UserX, Receipt, Building2, Eye } from "lucide-react";
import { notifyDataChanged } from "@/lib/dataSync";

const MODE = ["Razorpay", "Cash", "Bank Transfer", "Cheque", "UPI"];
const STATUS = ["Completed", "Pending", "Failed"];
const PERIODS = ["All", "Monthly", "Last 6 Months", "Yearly"];
function uniqCustomers(rows) { return new Set(rows.map((r) => r.customer_id || r.customer).filter(Boolean)).size; }
function inPeriod(dateValue, period) {
  if (period === "All" || !dateValue) return true;
  const d = new Date(dateValue); if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (period === "Yearly") return d.getFullYear() === now.getFullYear();
  if (period === "Monthly") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  const six = new Date(now); six.setMonth(now.getMonth() - 6); return d >= six;
}
const Field = ({ label, value }) => <div className="flex justify-between gap-4 py-2 border-b border-zinc-100"><span className="text-sm text-zinc-500">{label}</span><span className="text-sm font-medium text-zinc-800 text-right">{String(value ?? "—")}</span></div>;
function QuickActions({ onAgentPayment, period, setPeriod, statusFilter, setStatusFilter }) { const navigate = useNavigate(); return <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3"><span className="text-xs font-medium uppercase tracking-wider text-zinc-500 mr-1">Payment Filters</span><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36 border-zinc-300"><SelectValue /></SelectTrigger><SelectContent className="bg-white">{["All","Paid","Pending"].map((x) => <SelectItem key={x} value={x}>{x === "All" ? "All Statuses" : x}</SelectItem>)}</SelectContent></Select><Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-40 border-zinc-300"><SelectValue /></SelectTrigger><SelectContent className="bg-white">{PERIODS.map((x) => <SelectItem key={x} value={x}>{x === "All" ? "All Periods" : x}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" className="border-zinc-300" onClick={() => navigate("/admin/invoices")}><Receipt className="h-4 w-4 mr-1.5" />View Invoices</Button><Button variant="outline" size="sm" className="border-zinc-300" onClick={() => navigate("/admin/customers")}><Building2 className="h-4 w-4 mr-1.5" />View Customers</Button><Button size="sm" className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={onAgentPayment}><Wallet className="h-4 w-4 mr-1.5" />Record Agent Payment</Button></div>; }

export default function PaymentDashboard() {
  const [detail, setDetail] = useState(null), [refreshKey, setRefreshKey] = useState(0), [agentDialog, setAgentDialog] = useState(false);
  const [agents, setAgents] = useState([]), [tasks, setTasks] = useState([]), [period, setPeriod] = useState("All"), [statusFilter, setStatusFilter] = useState("All");
  const [agentForm, setAgentForm] = useState({ agent_id: "", agent: "", task_id: "", amount: "", mode: "Bank Transfer", reference_no: "", txn_date: new Date().toISOString().slice(0, 10), remarks: "" });
  const [agentSaving, setAgentSaving] = useState(false);
  const loadAgentData = () => {
    api.get("/agents").then(({ data }) => setAgents(Array.isArray(data?.data) ? data.data : [])).catch(() => {});
    api.get("/admin/agent-tasks/payable").then(({ data }) => setTasks(Array.isArray(data?.data) ? data.data : [])).catch(() => setTasks([]));
  };
  useEffect(loadAgentData, []);
  const saveAgentPayment = async () => {
    const amount = Number(agentForm.amount);
    if (!agentForm.agent_id) return toast.error("Agent is required");
    if (!(amount > 0)) return toast.error("Payment amount must be greater than zero");
    setAgentSaving(true);
    try {
      await api.post("/admin/agent-payments", { ...agentForm, agent_id: agentForm.agent_id, amount });
      toast.success("Agent payment recorded as Paid");
      notifyDataChanged(["payments", "agents", "tasks"]);
      setAgentDialog(false); setRefreshKey((k) => k + 1); loadAgentData();
      setAgentForm({ agent_id: "", agent: "", task_id: "", amount: "", mode: "Bank Transfer", reference_no: "", txn_date: new Date().toISOString().slice(0, 10), remarks: "" });
    } catch (e) { toast.error(describeApiError(e, "Unable to record agent payment")); }
    finally { setAgentSaving(false); }
  };
  const openDetail = async (row) => { setDetail({ payment: row }); try { const { data } = await api.get(`/admin/payments/${row.id || row.payment_id}/details`); setDetail(data?.data || null); } catch (e) { toast.error(describeApiError(e, "Unable to load payment details")); } };
  const rowFilter = useMemo(() => (rows) => rows.filter((r) => {
    const paid = ["Completed", "Paid"].includes(r.status) || r.payment_status === "Paid";
    const wantedStatus = statusFilter === "All" || (statusFilter === "Paid" ? paid : !paid);
    return wantedStatus && inPeriod(r.txn_date || r.created_at, period);
  }), [period, statusFilter]);

  return <>
    <CrudModule key={refreshKey} title="Payments" singular="Payment" name="payments" breadcrumb={["Super Admin", "Payments"]} subtitle="Payment collection, history, status and linked invoice/customer/service data." rowFilter={rowFilter}
      kpiFn={(rows) => { const completed = rows.filter((r) => ["Completed", "Paid"].includes(r.status)); const pending = rows.filter((r) => r.status === "Pending"); return [{ title: "Total Paid", value: inr(completed.reduce((s, r) => s + Number(r.total || r.amount || 0), 0)), icon: Wallet, tone: "green" }, { title: "Paid Customers", value: uniqCustomers(completed), icon: Users, tone: "royal" }, { title: "Pending Amount", value: inr(pending.reduce((s, r) => s + Number(r.total || r.amount || 0), 0)), icon: Clock, tone: "amber" }, { title: "Pending Customers", value: uniqCustomers(pending), icon: UserX, tone: "red" }]; }}
      extra={() => <QuickActions onAgentPayment={() => setAgentDialog(true)} period={period} setPeriod={setPeriod} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
      columns={[{ key: "payment_id", label: "Payment ID" }, { key: "customer", label: "Customer" }, { key: "invoice_no", label: "Invoice" }, { key: "service", label: "Service", render: (r) => r.service || r.service_name || "—" }, { key: "total", label: "Amount", render: (r) => inr(r.total || r.amount), exportValue: (r) => r.total || r.amount }, { key: "mode", label: "Mode" }, { key: "reference_no", label: "Reference" }, { key: "txn_date", label: "Date" }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.payment_status === "Paid" ? "Paid" : r.status} /> }, { key: "details", label: "Details", render: (r) => <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(r)}><Eye className="h-4 w-4" /></Button> }]}
      fields={[{ key: "payment_id", label: "Payment ID", required: true }, { key: "customer_id", label: "Customer", type: "relation", resource: "customers" }, { key: "invoice_id", label: "Invoice", type: "relation", resource: "invoices" }, { key: "total", label: "Amount (₹)", type: "number", required: true }, { key: "gst", label: "GST (₹)", type: "number" }, { key: "mode", label: "Payment Mode", type: "select", options: MODE, default: "Cash" }, { key: "reference_no", label: "Reference No" }, { key: "txn_date", label: "Transaction Date", type: "date" }, { key: "agent_id", label: "Agent", type: "relation", resource: "agents" }, { key: "status", label: "Status", type: "select", options: STATUS, default: "Pending" }, { key: "remarks", label: "Remarks", full: true, type: "textarea" }]} detailFields={["payment_id", "customer_id", "invoice_id", "total", "gst", "mode", "reference_no", "txn_date", "agent_id", "status", "remarks"]} />

    <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}><DialogContent className="bg-white max-w-2xl"><DialogHeader><DialogTitle>Payment Details</DialogTitle></DialogHeader>{detail && <Tabs defaultValue="payment"><TabsList className="grid grid-cols-4 w-full"><TabsTrigger value="payment">Payment</TabsTrigger><TabsTrigger value="customer">Customer</TabsTrigger><TabsTrigger value="invoice">Invoice</TabsTrigger><TabsTrigger value="service">Service</TabsTrigger></TabsList><TabsContent value="payment"><Card className="mt-4"><CardContent className="pt-6"><Field label="Payment ID" value={detail.payment?.payment_id} /><Field label="Status" value={detail.payment?.payment_status || detail.payment?.status} /><Field label="Amount" value={inr(detail.payment?.total || detail.payment?.amount)} /><Field label="Mode" value={detail.payment?.mode} /><Field label="Reference" value={detail.payment?.reference_no} /><Field label="Date" value={detail.payment?.txn_date} /></CardContent></Card></TabsContent><TabsContent value="customer"><Card className="mt-4"><CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader><CardContent><Field label="Customer" value={detail.customer?.business_name || detail.payment?.customer} /><Field label="Customer ID" value={detail.payment?.customer_id} /><Field label="GSTIN" value={detail.customer?.gstin} /></CardContent></Card></TabsContent><TabsContent value="invoice"><Card className="mt-4"><CardHeader><CardTitle className="text-base">Invoice</CardTitle></CardHeader><CardContent><Field label="Invoice" value={detail.invoice?.invoice_no || detail.payment?.invoice_no} /><Field label="Total" value={inr(detail.financials?.total ?? detail.invoice?.total)} /><Field label="Paid" value={inr(detail.financials?.paid)} /><Field label="Payment Status" value={detail.financials?.payment_status || detail.invoice?.payment_status} /><Field label="Balance" value={inr(detail.financials?.balance)} /></CardContent></Card></TabsContent><TabsContent value="service"><Card className="mt-4"><CardHeader><CardTitle className="text-base">Service</CardTitle></CardHeader><CardContent><Field label="Service" value={detail.service?.name || detail.service_name} /><Field label="Service ID" value={detail.service_id} /></CardContent></Card></TabsContent></Tabs>}{detail?.payment?.id && <RelationshipPanel entity="payment" recordId={detail.payment.id} />}</DialogContent></Dialog>
    <Dialog open={agentDialog} onOpenChange={setAgentDialog}><DialogContent className="bg-white max-w-lg"><DialogHeader><DialogTitle>Completed Task → Agent Payment</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
        <div className="sm:col-span-2"><Label>Completed Task</Label><Select value={agentForm.task_id || "__manual__"} onValueChange={(v) => { const t = tasks.find((x) => x.id === v); if (t) setAgentForm((s) => ({ ...s, task_id: t.id, agent_id: t.agent_id || "", agent: t.agent || "", amount: String(t.payable_amount || "") })); else setAgentForm((s) => ({ ...s, task_id: "", amount: "" })); }}><SelectTrigger className="mt-1.5 border-zinc-300"><SelectValue placeholder="Select completed payable task" /></SelectTrigger><SelectContent className="bg-white max-h-64"><SelectItem value="__manual__">Manual commission payment</SelectItem>{tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title} · {t.agent || "Agent"} · {inr(t.payable_amount)}</SelectItem>)}</SelectContent></Select></div>
        <div className="sm:col-span-2"><Label>Agent *</Label><Select value={agentForm.agent_id} onValueChange={(v) => { const selected = agents.find((a) => a.id === v); setAgentForm((s) => ({ ...s, agent_id: v, agent: selected?.name || "" })); }}><SelectTrigger className="mt-1.5 border-zinc-300"><SelectValue placeholder="Select agent" /></SelectTrigger><SelectContent className="bg-white">{agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Payable Amount (₹) *</Label><Input type="number" min="0.01" step="0.01" value={agentForm.amount} disabled={!!agentForm.task_id} onChange={(e) => setAgentForm((s) => ({ ...s, amount: e.target.value }))} className="mt-1.5 border-zinc-300" /></div>
        <div><Label>Payment Mode</Label><Select value={agentForm.mode} onValueChange={(v) => setAgentForm((s) => ({ ...s, mode: v }))}><SelectTrigger className="mt-1.5 border-zinc-300"><SelectValue /></SelectTrigger><SelectContent className="bg-white">{MODE.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Reference No</Label><Input value={agentForm.reference_no} onChange={(e) => setAgentForm((s) => ({ ...s, reference_no: e.target.value }))} className="mt-1.5 border-zinc-300" /></div>
        <div><Label>Payment Date</Label><Input type="date" value={agentForm.txn_date} onChange={(e) => setAgentForm((s) => ({ ...s, txn_date: e.target.value }))} className="mt-1.5 border-zinc-300" /></div>
        <div className="sm:col-span-2"><Label>Notes</Label><Input value={agentForm.remarks} onChange={(e) => setAgentForm((s) => ({ ...s, remarks: e.target.value }))} className="mt-1.5 border-zinc-300" /></div>
      </div>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAgentDialog(false)}>Cancel</Button><Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={saveAgentPayment} disabled={agentSaving}>{agentSaving ? "Saving..." : "Record Payment"}</Button></div>
    </DialogContent></Dialog>
  </>;
}
