import { useMemo } from "react";
import { useCrud } from "@/hooks/useCrud";

const blank = (v) => v === undefined || v === null || v === "";
const num = (v) => (blank(v) || Number.isNaN(Number(v)) ? null : Number(v));

// Joins the logged-in customer's own invoices and bookings (both endpoints are already scoped to the
// authenticated customer on the server) so My Invoices and My Profile show the same real purchases.
// A booking that has no invoice yet is still a purchase: it is listed with an "Invoice pending" status,
// priced with the same rule the backend billing uses (booking fee -> project value -> service price).
export function useCustomerPurchases() {
  const inv = useCrud("invoices");
  const bk = useCrud("bookings");
  const svc = useCrud("services", { pollMs: 0 });
  // /payments is scoped to the authenticated customer on the server, like /invoices and /bookings.
  const pay = useCrud("payments", { pollMs: 0 });

  const loading = inv.loading || bk.loading || pay.loading;

  const rows = useMemo(() => {
    const bookings = bk.rows || [];
    const priceOf = (b) => {
      const fee = !blank(b.estimated_fee) ? b.estimated_fee : !blank(b.project_value) ? b.project_value : (svc.rows || []).find((s) => s.id === b.service_id)?.final_price;
      return num(fee);
    };
    const findBooking = (ref) => bookings.find((b) => ref && (b.id === ref || b.booking_no === ref));
    const dateOf = (p) => String(p.payment_date || p.txn_date || p.date || p.recorded_at || p.created_at || "").slice(0, 10);
    const isPaid = (p) => ["completed", "paid", "success"].includes(String(p.status || "").toLowerCase());
    // Latest completed payment recorded against an invoice and/or booking (real payment rows only).
    const paymentDateFor = (invoice, booking) => {
      const dates = (pay.rows || [])
        .filter((p) => isPaid(p) && (
          (invoice && (p.invoice_id === invoice.id || (p.invoice_no && p.invoice_no === invoice.invoice_no))) ||
          (booking && p.booking_id && (p.booking_id === booking.id || p.booking_id === booking.booking_no))))
        .map(dateOf).filter(Boolean).sort();
      return dates.length ? dates[dates.length - 1] : "";
    };
    const consultantOf = (b, i) => b?.assigned_agent || b?.agent || i?.agent || b?.assigned_employee || "";

    const out = (inv.rows || []).map((i) => {
      const b = findBooking(i.booking_id);
      return {
        id: i.id || i.invoice_no,
        kind: "invoice",
        invoice_no: i.invoice_no || i.id,
        customer: i.customer || b?.customer || "",
        service: i.service || b?.service || "",
        booking_ref: b?.booking_no || i.booking_id || "",
        date: String(i.invoice_date || i.issue_date || i.created_at || b?.booking_date || b?.created_at || "").slice(0, 10),
        booking_date: String(b?.booking_date || b?.created_at || "").slice(0, 10),
        due_date: String(i.due_date || b?.due_date || "").slice(0, 10),
        consultant: consultantOf(b, i),
        payment_date: paymentDateFor(i, b),
        amount: num(i.total) ?? num(i.amount),
        payment_status: i.payment_status || i.status || "Pending",
        invoice_status: i.status || i.payment_status || "Issued",
        booking_status: b?.status || "",
        invoice: i,
      };
    });

    const invoiced = new Set((inv.rows || []).map((i) => i.booking_id).filter(Boolean));
    bookings.forEach((b) => {
      if (invoiced.has(b.id) || invoiced.has(b.booking_no)) return;
      if (b.status === "Cancelled") return;
      out.push({
        id: `bk-${b.id}`,
        kind: "booking",
        invoice_no: "",
        customer: b.customer || "",
        service: b.service || "",
        booking_ref: b.booking_no || b.id,
        date: String(b.booking_date || b.created_at || "").slice(0, 10),
        booking_date: String(b.booking_date || b.created_at || "").slice(0, 10),
        due_date: String(b.due_date || "").slice(0, 10),
        consultant: consultantOf(b, null),
        payment_date: paymentDateFor(null, b),
        amount: priceOf(b),
        payment_status: b.payment_status || "Pending",
        invoice_status: "Invoice pending",
        booking_status: b.status || "",
        invoice: null,
      });
    });
    return out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [inv.rows, bk.rows, svc.rows, pay.rows]);

  return { rows, invoices: inv.rows || [], bookings: bk.rows || [], loading };
}

// The stored invoice may only carry amount/gst (invoices created at payment time). Fill the tax breakdown the
// preview and PDF expect from what is really stored, never from invented values.
export function toPrintableInvoice(row, customer, user) {
  const i = row.invoice || {};
  const total = num(i.total) ?? num(i.amount) ?? row.amount ?? 0;
  const hasSplit = !blank(i.cgst) || !blank(i.sgst) || !blank(i.igst);
  const gst = num(i.gst) ?? 0;
  const taxable = num(i.taxable) ?? num(i.amount) ?? total;
  return {
    ...i,
    invoice_no: row.invoice_no,
    customer: row.customer || customer?.business_name || user?.name || "",
    gst_number: i.gst_number || customer?.gst_number || "N/A",
    invoice_date: row.date || "",
    taxable,
    discount: num(i.discount) ?? 0,
    cgst: hasSplit ? num(i.cgst) ?? 0 : gst / 2,
    sgst: hasSplit ? num(i.sgst) ?? 0 : gst / 2,
    igst: hasSplit ? num(i.igst) ?? 0 : 0,
    total,
    payment_status: row.payment_status,
  };
}
