import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Download, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { exportPDF } from "@/lib/exports";
import { inr } from "@/lib/utils";

// The stage *labels* are fixed, but whether each one is done/current/pending
// is derived entirely from the real booking record returned by the backend
// (status, payment_status, assigned_agent) — never hard-coded per booking.
function buildTimeline(b) {
  const paid = b.payment_status === "Paid";
  const assigned = !!(b.assigned_agent || b.assigned_employee);
  const running = b.status === "Running";
  const completed = b.status === "Completed";

  return [
    { label: "Booking Created", done: true, note: b.created_at ? new Date(b.created_at).toLocaleString() : b.booking_date },
    { label: "Payment Completed", done: paid, note: paid ? "Paid" : "Awaiting payment" },
    { label: "Consultant Assigned", done: assigned, note: assigned ? (b.assigned_agent || b.assigned_employee) : "Not yet assigned" },
    { label: "Work In Progress", done: running || completed, note: running ? "In progress" : completed ? "Completed" : "Not started" },
    { label: "Service Completed", done: completed, note: completed ? "Completed" : "Pending" },
  ];
}

export default function ServiceTrackingModal({ bookingId, open, onOpenChange }) {
  const [booking, setBooking] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data: bkg }, { data: invs }] = await Promise.all([
          api.get(`/bookings/${bookingId}`),
          api.get(`/invoices`),
        ]);
        setBooking(bkg.data);
        const inv = (invs.data || []).find((i) => i.booking_id === bookingId);
        setInvoice(inv || null);
      } catch (e) {
        // handled by global api error toast
      } finally {
        setLoading(false);
      }
    })();
  }, [open, bookingId]);

  const timeline = booking ? buildTimeline(booking) : [];
  const currentIndex = timeline.findIndex((t) => !t.done);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-lg max-h-[85vh] overflow-y-auto" data-testid="service-tracking-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg text-[#0A2540]">Service Tracking</DialogTitle>
        </DialogHeader>

        {loading || !booking ? (
          <div className="py-10 flex items-center justify-center text-zinc-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-zinc-200 p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="font-semibold text-zinc-900">{booking.service}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Booking ID</span><span className="font-medium">{booking.booking_no || booking.id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Booked On</span><span className="font-medium">{booking.booking_date || "—"}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><StatusBadge value={booking.status} /></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Payment</span><StatusBadge value={booking.payment_status} /></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Priority</span><PriorityBadge value={booking.priority} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Consultant</span><span className="font-medium">{booking.assigned_agent || booking.assigned_employee || "Not yet assigned"}</span></div>
              {booking.estimated_fee ? <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">{inr(booking.estimated_fee)}</span></div> : null}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Lifecycle</h4>
              <div className="space-y-0">
                {timeline.map((t, i) => {
                  const active = i === currentIndex;
                  return (
                    <div key={t.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        {t.done ? <CheckCircle2 className="h-5 w-5 text-brand-hover" /> : <Circle className={`h-5 w-5 ${active ? "text-brand fill-brand-light" : "text-zinc-300"}`} />}
                        {i < timeline.length - 1 && <div className={`w-px flex-1 min-h-[22px] ${t.done ? "bg-brand" : "bg-zinc-200"}`} />}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm font-medium ${t.done || active ? "text-zinc-900" : "text-zinc-400"}`}>{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {invoice ? (
              <div className="rounded-xl border border-zinc-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Invoice {invoice.invoice_no}</p>
                  <p className="text-xs text-muted-foreground">{inr(invoice.total)} · {invoice.payment_status}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-300"
                  onClick={() => {
                    exportPDF(`Invoice ${invoice.invoice_no}`, [{ key: "k", label: "Field" }, { key: "v", label: "Value" }], [
                      { k: "Invoice No.", v: invoice.invoice_no }, { k: "Booking", v: booking.booking_no || booking.id },
                      { k: "Amount", v: inr(invoice.amount) }, { k: "GST", v: inr(invoice.gst) }, { k: "Total", v: inr(invoice.total) },
                      { k: "Status", v: invoice.payment_status }, { k: "Issue Date", v: invoice.issue_date },
                    ]);
                  }}
                  data-testid="tracking-download-invoice"
                >
                  <Download className="h-4 w-4 mr-1.5" />Invoice
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">No invoice yet — generated once payment is completed.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
