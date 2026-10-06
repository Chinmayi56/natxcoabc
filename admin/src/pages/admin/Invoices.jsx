import { useState } from "react";
import { Download, Printer, Eye, RefreshCw } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportInvoicePDF } from "@/lib/exports";
import api, { describeApiError } from "@/lib/api";
import { inr } from "@/lib/utils";
import { toast } from "sonner";
import RelationshipPanel from "@/components/shared/RelationshipPanel";
import { Receipt, CheckCircle2, Clock, AlertCircle } from "lucide-react";

function InvoicePreview({ inv }) {
  const Row = ({ l, v, bold }) => (
    <div className={`flex justify-between py-1.5 ${bold ? "font-semibold text-zinc-900 border-t border-zinc-200 mt-1 pt-2" : "text-zinc-600"}`}>
      <span>{l}</span><span>{v}</span>
    </div>
  );
  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden" data-testid="invoice-preview">
      <div className="bg-brand px-6 py-4">
        <p className="font-heading text-lg font-extrabold text-zinc-900">Nizam's TaX Consultancy</p>
        <p className="text-xs text-zinc-800">Indian Tax • GST • Accounting • Compliance</p>
      </div>
      <div className="p-6">
        <div className="flex justify-between text-sm mb-4">
          <div><p className="text-xs text-zinc-400 uppercase tracking-wider">Bill To</p><p className="font-medium text-zinc-900">{inv.customer || "—"}</p><p className="text-xs text-zinc-500">GSTIN: {inv.gst_number || "—"}</p></div>
          <div className="text-right"><p className="text-xs text-zinc-400 uppercase tracking-wider">Invoice</p><p className="font-medium text-zinc-900">{inv.invoice_no}</p><p className="text-xs text-zinc-500">{inv.invoice_date || inv.issue_date || "—"}</p></div>
        </div>
        <div className="text-sm"><Row l="Taxable Amount" v={inr(inv.taxable ?? inv.amount)} /><Row l="Discount" v={`- ${inr(inv.discount)}`} /><Row l={`CGST (${(inv.rate || 0) / 2}%)`} v={inr(inv.cgst)} /><Row l={`SGST (${(inv.rate || 0) / 2}%)`} v={inr(inv.sgst)} /><Row l={`IGST (${inv.rate || 0}%)`} v={inr(inv.igst)} /><Row l="Grand Total" v={inr(inv.total)} bold /></div>
        <div className="mt-4 flex items-center justify-between"><StatusBadge value={inv.payment_status || inv.status} /><span className="text-xs text-zinc-400">Computer-generated invoice</span></div>
      </div>
    </div>
  );
}

const Field = ({ label, value }) => <div className="flex justify-between gap-4 py-2 border-b border-zinc-100"><span className="text-sm text-zinc-500">{label}</span><span className="text-sm font-medium text-zinc-800 text-right">{String(value ?? "—")}</span></div>;

export default function Invoices() {
  const { rows, loading } = useCrud("invoices");
  const [preview, setPreview] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const paid = rows.filter((r) => r.payment_status === "Paid");
  const pending = rows.filter((r) => r.payment_status === "Pending");
  const overdue = rows.filter((r) => r.payment_status === "Overdue");
  const totalBilled = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const paidAmount = rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const pendingAmount = pending.reduce((s, r) => s + Number(r.balance || 0), 0);
  const overdueAmount = overdue.reduce((s, r) => s + Number(r.balance || 0), 0);
  const paidPct = totalBilled > 0 ? Math.round((paidAmount / totalBilled) * 100) : 0;

  const openDetails = async (r) => {
    setDetailsLoading(true); setDetails({ invoice: r, financials: { total: r.total || 0, paid: r.paid_amount || 0, balance: Math.max((r.total || 0) - (r.paid_amount || 0), 0) }, payments: [] });
    try { const { data } = await api.get(`/admin/invoices/${r.id}/details`); setDetails(data?.data || null); }
    catch (e) { toast.error(describeApiError(e, "Unable to load invoice details")); }
    finally { setDetailsLoading(false); }
  };

  const columns = [
    { key: "invoice_no", label: "Invoice No" }, { key: "customer", label: "Customer" }, { key: "gst_number", label: "GSTIN" },
    { key: "service", label: "Service", render: (r) => r.service || r.service_name || "—" }, { key: "due_date", label: "Due Date", render: (r) => r.due_date || "—" },
    { key: "total", label: "Amount", render: (r) => inr(r.total), exportValue: (r) => r.total },
    { key: "paid_amount", label: "Paid", render: (r) => inr(r.paid_amount), exportValue: (r) => r.paid_amount },
    { key: "balance", label: "Balance", render: (r) => inr(r.balance) },
    { key: "payment_status", label: "Status", render: (r) => <StatusBadge value={r.payment_status || r.status} /> },
    { key: "actions", label: "Actions", render: (r) => <div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetails(r)}><Eye className="h-4 w-4 text-zinc-500" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreview(r)}><Receipt className="h-4 w-4 text-zinc-500" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportInvoicePDF(r)}><Download className="h-4 w-4 text-brand-hover" /></Button></div> },
  ];

  return <div>
    <PageHeader title="Invoices" breadcrumb={["Super Admin", "Invoices"]} subtitle="Invoice financials and linked customer, service and payment data." />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4"><KpiCard title="Total Billed" value={inr(totalBilled)} icon={Receipt} loading={loading} /><KpiCard title="Paid Invoices" value={paid.length} icon={CheckCircle2} loading={loading} /><KpiCard title="Pending Invoices" value={pending.length} icon={Clock} loading={loading} /><KpiCard title="Overdue Invoices" value={overdue.length} icon={AlertCircle} loading={loading} /></div>
    {!loading && rows.length > 0 && <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-4 mb-6"><div className="flex items-center justify-between text-sm mb-2"><span className="text-zinc-600">Collected vs Billed</span><span className="font-semibold text-zinc-900">{paidPct}%</span></div><Progress value={paidPct} className="h-2 bg-zinc-100 [&>div]:bg-emerald-500" /></div>}
    <DataTable title="Invoices" columns={columns} rows={rows} loading={loading} pageSize={8} testId="invoices-table" />
    <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}><DialogContent className="bg-white max-w-lg"><DialogHeader><DialogTitle className="font-heading">Invoice Preview</DialogTitle></DialogHeader>{preview && <><InvoicePreview inv={preview} /><div className="flex justify-end gap-2 mt-2"><Button variant="outline" className="border-zinc-300" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" />Print</Button><Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={() => exportInvoicePDF(preview)}><Download className="h-4 w-4 mr-1.5" />Download PDF</Button></div></>}</DialogContent></Dialog>
    <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}><DialogContent className="bg-white max-w-3xl max-h-[88vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-heading flex items-center gap-2">Invoice Details {detailsLoading && <RefreshCw className="h-4 w-4 animate-spin" />}</DialogTitle></DialogHeader>{details && <Tabs defaultValue="services"><TabsList className="grid grid-cols-4 w-full"><TabsTrigger value="services">Services</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="customer">Customer</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger></TabsList><TabsContent value="services" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Service</CardTitle></CardHeader><CardContent><Field label="Service" value={details.service?.name || details.service_name} /><Field label="Service ID" value={details.service_id} /><Field label="Booking ID" value={details.booking?.id || details.invoice?.booking_id} /></CardContent></Card></TabsContent><TabsContent value="payments" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Financials</CardTitle></CardHeader><CardContent><Field label="Invoice Total" value={inr(details.financials?.total)} /><Field label="Paid" value={inr(details.financials?.paid)} /><Field label="Balance" value={inr(details.financials?.balance)} />{(details.payments || []).map((p) => <Field key={p.id || p.payment_id} label={p.payment_id || "Payment"} value={`${inr(p.total || p.amount)} • ${p.status || "—"}`} />)}</CardContent></Card></TabsContent><TabsContent value="customer" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader><CardContent><Field label="Customer" value={details.customer?.business_name || details.invoice?.customer} /><Field label="Customer ID" value={details.invoice?.customer_id} /><Field label="GSTIN" value={details.customer?.gstin || details.invoice?.gst_number} /><Field label="Email" value={details.customer?.email} /></CardContent></Card></TabsContent><TabsContent value="notes" className="mt-4"><Card><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent><p className="text-sm text-zinc-700 whitespace-pre-wrap">{details.invoice?.notes || details.invoice?.remarks || "No notes recorded."}</p></CardContent></Card></TabsContent></Tabs>}{details?.invoice?.id && <RelationshipPanel entity="invoice" recordId={details.invoice.id} />}</DialogContent></Dialog>
  </div>;
}
