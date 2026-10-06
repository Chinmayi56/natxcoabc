import { useState, useEffect } from "react";
import {
  Briefcase, FolderKanban, CheckCircle2,
  Wallet, Receipt, FolderOpen, LifeBuoy, Bell, Clock,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartCard, AreaChartView, BarChartView, DonutChartView } from "@/components/shared/Charts";
import { ActivityFeed, DueDatesWidget } from "@/components/shared/Widgets";
import SiteImageGallery from "@/components/shared/SiteImageGallery";
import { useAuth } from "@/context/AuthContext";
import api, { describeApiError } from "@/lib/api";
import { inr } from "@/lib/utils";
import { toast } from "sonner";

const B = "/customer";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState(null);
  const [live, setLive] = useState({ filings: [], spending: [], service_usage: [], due_dates: [] });

  // Real, per-customer numbers from MongoDB via GET /api/customer/dashboard
  // (server derives the customer from the JWT — never a client-supplied id),
  // instead of hard-coded figures.
  useEffect(() => {
    if (!user) { setCards(null); setLoading(false); return undefined; }
    let active = true;
    const load = async (silent) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get("/customer/dashboard");
        if (!active) return;
        setCards(data.data.cards);
        setLive({ filings: data.data.filings || [], spending: data.data.spending || [], service_usage: data.data.service_usage || [], due_dates: data.data.due_dates || [] });
      } catch (e) {
        if (!silent) toast.error(describeApiError(e, "Could not load your dashboard"));
      } finally {
        if (active && !silent) setLoading(false);
      }
    };
    load(false);
    // Re-read from the backend so statuses the admin changes appear without a manual refresh.
    const tick = () => { if (!document.hidden) load(true); };
    const timer = window.setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, [user]);

  const kpis = [
    { title: "Total Services", value: cards?.total_services ?? 0, icon: Briefcase, to: `${B}/bookings` },
    { title: "Active Services", value: cards?.active_services ?? 0, icon: FolderKanban, to: `${B}/bookings` },
    { title: "Completed Services", value: cards?.completed_services ?? 0, icon: CheckCircle2, to: `${B}/bookings` },
    { title: "Pending Payment", value: cards?.pending_payment ?? 0, icon: Clock, to: `${B}/bookings` },
    { title: "Outstanding", value: cards ? inr(cards.outstanding) : 0, icon: Wallet, to: `${B}/invoices` },
    { title: "Paid Invoices", value: cards?.payments_done ?? 0, icon: Receipt, to: `${B}/invoices` },
    { title: "Pending Invoices", value: cards?.pending_invoices ?? 0, icon: Receipt, to: `${B}/invoices` },
    { title: "Documents", value: cards?.documents ?? 0, icon: FolderOpen, to: `${B}/documents` },
    { title: "Support Tickets", value: cards?.tickets ?? 0, icon: LifeBuoy, to: `${B}/support` },
    { title: "Notifications", value: cards?.notifications ?? 0, icon: Bell, to: `${B}/notifications` },
  ];

  const filingTrendLive = live.filings.reduce((m, r) => { const k = String(r.period || r.quarter || r.ay || "").slice(0, 7); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
  const filingChart = Object.entries(filingTrendLive).map(([m, gst]) => ({ m, gst }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader title="Customer Dashboard" subtitle={user?.name ? `Welcome back, ${user.name}` : "Public overview — sign in when you want to book and manage services"} breadcrumb={["Customer", "Dashboard"]} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((c, i) => <KpiCard key={i} {...c} loading={loading} testId={`kpi-${i}`} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Monthly GST Filing History" testId="chart-gst">
          <BarChartView data={filingChart} xKey="m" keys={[{ key: "gst", name: "GST Filed" }]} />
        </ChartCard>
        <ChartCard title="Monthly Spending (₹)" testId="chart-spending">
          <AreaChartView data={live.spending} xKey="m" keys={[{ key: "amount", name: "Spend" }]} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <ChartCard title="Service Usage" testId="chart-usage">
          <DonutChartView data={live.service_usage.slice(0, 5)} />
        </ChartCard>
        <div className="lg:col-span-2"><ActivityFeed items={live.due_dates.slice(0,6).map(x => ({ title: x.title, time: x.date || "Scheduled", tag: x.type || "Service" }))} /></div>
      </div>
      <DueDatesWidget items={live.due_dates} />
      <SiteImageGallery placement="dashboard" title="Highlights" className="mt-6" container={false} />
      {!user && <div className="mt-6 rounded-2xl border border-zinc-200 bg-brand-faint p-5 text-sm text-zinc-700"><strong className="text-[#0A2540]">Customer workspace:</strong> Dashboard viewing is public. Sign in or create an account only when you want to book a service or access your personal bookings, documents, invoices and payments.</div>}
    </div>
  );
}
