import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

const LABELS = {
  customer: "Customer",
  booking: "Booking",
  service: "Service",
  agent: "Agent",
  invoice: "Invoice",
  payment: "Payment",
};

const listRoute = {
  customer: "/admin/customers",
  booking: "/admin/bookings",
  service: "/admin/services",
  agent: "/admin/agents",
  invoice: "/admin/invoices",
  payment: "/admin/payments",
};

function recordLabel(type, row) {
  if (!row) return "—";
  if (type === "customer") return row.business_name || row.cust_id || row.id;
  if (type === "booking") return row.booking_no || row.id;
  if (type === "service") return row.name || row.title || row.id;
  if (type === "agent") return row.name || row.agent_id || row.id;
  if (type === "invoice") return row.invoice_no || row.id;
  if (type === "payment") return row.payment_id || row.id;
  return row.id;
}

function RelatedList({ title, type, rows = [], navigate }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">{title}</div>
      <div className="space-y-1.5">
        {rows.slice(0, 8).map((row) => (
          <div key={row.id || row.payment_id || row.invoice_no} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-zinc-800">{recordLabel(type, row)}</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-royal" onClick={() => navigate(listRoute[type])}>
              Open
            </Button>
          </div>
        ))}
        {rows.length > 8 && <p className="text-xs text-zinc-400">+{rows.length - 8} more</p>}
      </div>
    </div>
  );
}

export default function RelationshipPanel({ entity, recordId }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!entity || !recordId) return undefined;
    const load = () => {
      setLoading(true);
      api.get(`/relationships/${entity}/${recordId}`)
        .then(({ data: response }) => { if (active) setData(response?.data || null); })
        .catch(() => { if (active) setData(null); })
        .finally(() => { if (active) setLoading(false); });
    };
    load();
    const onChange = (event) => {
      if (event?.detail?.resources?.length) load();
    };
    window.addEventListener("ntaxco:data-changed", onChange);
    return () => {
      active = false;
      window.removeEventListener("ntaxco:data-changed", onChange);
    };
  }, [entity, recordId]);

  const sections = useMemo(() => {
    if (!data) return [];
    const single = [];
    const lists = [];
    if (data.customer) single.push(["Customer", "customer", data.customer]);
    if (data.booking) single.push(["Booking", "booking", data.booking]);
    if (data.service) single.push(["Service", "service", data.service]);
    if (data.agent) single.push(["Agent", "agent", data.agent]);
    if (data.invoice) single.push(["Invoice", "invoice", data.invoice]);
    if (data.payments?.length) lists.push(["Payments", "payment", data.payments]);
    if (data.bookings?.length) lists.push(["Bookings", "booking", data.bookings]);
    if (data.invoices?.length) lists.push(["Invoices", "invoice", data.invoices]);
    return { single, lists };
  }, [data]);

  if (loading) return <div className="mt-5 flex items-center gap-2 text-xs text-zinc-500"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Loading relationships…</div>;
  if (!data) return null;

  return (
    <div className="mt-6 border-t border-zinc-200 pt-5" data-testid={`relationships-${entity}`}>
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="h-4 w-4 text-royal" />
        <h4 className="font-heading font-bold text-sm text-zinc-900">Related records</h4>
      </div>
      <div className="space-y-2">
        {sections.single.map(([title, type, row]) => (
          <div key={type} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
            <div>
              <div className="text-xs text-zinc-500">{title}</div>
              <div className="text-sm font-semibold text-zinc-900">{recordLabel(type, row)}</div>
              <div className="text-[11px] text-zinc-400">ID: {row.id}</div>
            </div>
            <Button type="button" variant="outline" size="sm" className="border-zinc-300" onClick={() => navigate(listRoute[type])}>Open {LABELS[type]}</Button>
          </div>
        ))}
        {sections.lists.map(([title, type, rows]) => <RelatedList key={title} title={title} type={type} rows={rows} navigate={navigate} />)}
        {!sections.single.length && !sections.lists.length && <p className="text-xs text-zinc-500">No related records yet.</p>}
      </div>
    </div>
  );
}
