import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCustomerPurchases } from "@/hooks/useCustomerPurchases";
import api, { describeApiError } from "@/lib/api";
import { inr } from "@/lib/utils";
import { Building2, Mail, Phone, MapPin, FileText, Hash, User, CalendarCheck, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const fmtDateTime = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

export default function CustomerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const { rows: history, loading: historyLoading } = useCustomerPurchases();
  const accountKey = user?.id;

  useEffect(() => {
    // Drop whatever the previous customer left in state before loading this one.
    setProfile(null);
    if (!user) return undefined;
    let active = true;
    const linked = user?.meta?.customer_id;
    const sameLogin = (c) => (c?.email && user.email && String(c.email).toLowerCase() === String(user.email).toLowerCase())
      || (c?.mobile && user.mobile && String(c.mobile) === String(user.mobile));
    // The backend only ever returns the authenticated customer's own record (other ids -> 404).
    // Prefer the id linked to this login; otherwise accept the single record the server scoped to this
    // login, and only if it matches this login's email/mobile. Never pick an arbitrary row.
    const request = linked
      ? api.get(`/customers/${encodeURIComponent(linked)}`).then(({ data }) => data?.data || null)
      : api.get("/customers").then(({ data }) => {
        const rows = data?.data || [];
        return rows.length === 1 && sameLogin(rows[0]) ? rows[0] : null;
      });
    request
      .then((own) => { if (active) setProfile(own); })
      .catch((e) => toast.error(describeApiError(e, "Unable to load your profile")));
    return () => { active = false; };
  }, [accountKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = profile || {};
  const address = [p.address, p.city, p.state, p.pincode].filter(Boolean).join(", ");
  const fields = [
    { icon: User, label: "Customer Name", value: p.owner || user?.name },
    { icon: Building2, label: "Business Name", value: p.business_name },
    { icon: Phone, label: "Mobile", value: p.mobile || user?.mobile },
    { icon: Mail, label: "Email", value: p.email || user?.email },
    { icon: MapPin, label: "Address", value: address },
    { icon: Hash, label: "Customer ID", value: p.cust_id || p.id || user?.meta?.customer_id },
    { icon: ShieldCheck, label: "Account Status", value: p.status },
    { icon: FileText, label: "Onboarding Status", value: p.onboarding_status },
    { icon: FileText, label: "Business Type", value: p.business_type },
    { icon: Hash, label: "GST Number", value: p.gst_number },
    { icon: Hash, label: "PAN", value: p.pan },
    { icon: CalendarCheck, label: "Registration", value: fmtDateTime(p.created_at) || (user?.meta?.registered ? "Self-registered" : null) },
    { icon: LogIn, label: "Last Login", value: fmtDateTime(p.last_login) },
  ];

  const columns = [
    { key: "booking_ref", label: "Booking ID", render: (r) => r.booking_ref || "—" },
    { key: "service", label: "Service", render: (r) => r.service || "—" },
    { key: "booking_date", label: "Booking Date", render: (r) => r.booking_date || "—" },
    { key: "due_date", label: "Due Date", render: (r) => r.due_date || "—" },
    { key: "consultant", label: "Consultant", render: (r) => r.consultant || "—" },
    { key: "amount", label: "Amount", render: (r) => (r.amount == null ? "—" : inr(r.amount)), exportValue: (r) => r.amount },
    { key: "payment_status", label: "Payment", render: (r) => <StatusBadge value={r.payment_status} /> },
    { key: "booking_status", label: "Service Status", render: (r) => (r.booking_status ? <StatusBadge value={r.booking_status} /> : "—") },
    { key: "invoice_no", label: "Invoice", render: (r) => r.invoice_no || <span className="text-zinc-400">Pending</span> },
    { key: "payment_date", label: "Payment Date", render: (r) => r.payment_date || "—" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader title="My Profile" breadcrumb={["Customer", "My Profile"]} subtitle="Your account details and purchase history." />
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden mb-8" data-testid="customer-profile-card">
        <div className="bg-gradient-to-br from-brand-light to-brand-faint p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-brand-hover"><User className="h-8 w-8" /></div>
          <div>
            <h2 className="font-heading text-xl font-bold text-zinc-900" data-testid="profile-name">{p.owner || p.business_name || user?.name}</h2>
            <p className="text-sm text-zinc-600">Customer ID: {p.cust_id || p.id || user?.meta?.customer_id || "—"}</p>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-3 py-3 border-b border-zinc-100">
              <f.icon className="h-4 w-4 text-zinc-400 shrink-0" />
              <span className="text-sm text-muted-foreground w-40">{f.label}</span>
              <span className="text-sm font-medium text-zinc-800 ml-auto text-right">{f.value || "—"}</span>
            </div>
          ))}
        </div>
      </div>
      <h2 className="font-heading text-lg font-bold text-zinc-900 mb-3" data-testid="history-heading">Purchase / Service History</h2>
      <DataTable key={accountKey} title="Purchase / Service History" columns={columns} rows={history} loading={historyLoading} pageSize={8} testId="customer-history-table" />
    </div>
  );
}
