import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCrud } from "@/hooks/useCrud";
import { useCustomerPurchases, toPrintableInvoice } from "@/hooks/useCustomerPurchases";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KpiCard } from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download, Printer, Receipt, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { exportInvoicePDF } from "@/lib/exports";
import { inr } from "@/lib/utils";

export default function CustomerInvoices() {
  const { user } = useAuth();
  const { rows, invoices, loading } = useCustomerPurchases();
  const { rows: profiles } = useCrud("customers", { pollMs: 0 });
  // /customers is scoped to the logged-in customer by the server; prefer the record linked to this login.
  const myProfile = profiles?.find((c) => c.id === user?.meta?.customer_id) || (profiles?.length === 1 ? profiles[0] : null);
  const [preview, setPreview] = useState(null);
  // /api/invoices, /api/bookings and /api/payments are scoped on the server to the authenticated customer
  // (customer_id comes from the login token), so nothing is filtered or guessed by name here.
  // Only real invoice records are listed; bookings that have no invoice yet live in My Profile history.
  const mine = rows.filter((r) => r.kind === "invoice");
  const printable = (r) => toPrintableInvoice(r, myProfile, user);

  const paid = invoices.filter((r) => r.payment_status === "Paid");
  const pending = invoices.filter((r) => r.payment_status === "Pending" || r.payment_status === "Partial");
  const overdue = invoices.filter((r) => r.payment_status === "Overdue");

  const columns = [
    { key: "invoice_no", label: "Invoice", render: (r) => r.invoice_no || <span className="text-zinc-400">Not generated</span> },
    { key: "customer", label: "Customer", render: (r) => r.customer || user?.name || "—" },
    { key: "service", label: "Service", render: (r) => r.service || "—" },
    { key: "booking_ref", label: "Booking ID", render: (r) => r.booking_ref || "—" },
    { key: "date", label: "Invoice Date", render: (r) => r.date || "—" },
    { key: "amount", label: "Amount", render: (r) => (r.amount == null ? "—" : inr(r.amount)), exportValue: (r) => r.amount },
    { key: "payment_status", label: "Payment", render: (r) => <StatusBadge value={r.payment_status} /> },
    { key: "invoice_status", label: "Invoice Status", render: (r) => <StatusBadge value={r.invoice_status} /> },
    { key: "payment_date", label: "Payment Date", render: (r) => r.payment_date || "—" },
    {
      key: "actions", label: "Actions",
      render: (r) => r.kind !== "invoice" ? null : (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreview(printable(r))} data-testid={`preview-${r.id}`}><Eye className="h-4 w-4 text-zinc-500" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportInvoicePDF(printable(r))} data-testid={`pdf-${r.id}`}><Download className="h-4 w-4 text-brand-hover" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader title="Invoices" breadcrumb={["Customer", "Invoices"]} subtitle="View and download your GST invoices." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Invoices" value={invoices.length} icon={Receipt} loading={loading} testId="ci-total" />
        <KpiCard title="Paid" value={paid.length} icon={CheckCircle2} loading={loading} testId="ci-paid" />
        <KpiCard title="Pending" value={pending.length} icon={Clock} loading={loading} testId="ci-pending" />
        <KpiCard title="Overdue" value={overdue.length} icon={AlertCircle} loading={loading} testId="ci-overdue" />
      </div>
      <DataTable title="My Invoices" columns={columns} rows={mine} loading={loading} pageSize={8} testId="customer-invoices-table" />

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Invoice {preview?.invoice_no}</DialogTitle></DialogHeader>
          {preview && (
            <div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="bg-brand px-6 py-4"><p className="font-heading text-lg font-extrabold text-zinc-900">Nizam's TaX Consultancy</p></div>
                <div className="p-6 text-sm">
                  <div className="flex justify-between mb-3"><span className="text-muted-foreground">GSTIN</span><span className="font-medium">{preview.gst_number}</span></div>
                  {[["Taxable", preview.taxable], ["Discount", preview.discount], ["CGST", preview.cgst], ["SGST", preview.sgst], ["IGST", preview.igst]].map(([l, v]) => (
                    <div key={l} className="flex justify-between py-1 text-zinc-600"><span>{l}</span><span>{inr(v)}</span></div>
                  ))}
                  <div className="flex justify-between py-2 mt-1 border-t border-zinc-200 font-semibold text-zinc-900"><span>Grand Total</span><span>{inr(preview.total)}</span></div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" className="border-zinc-300" onClick={() => window.print()} data-testid="print-inv"><Printer className="h-4 w-4 mr-1.5" />Print</Button>
                <Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={() => exportInvoicePDF(preview)} data-testid="download-inv"><Download className="h-4 w-4 mr-1.5" />Download</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
