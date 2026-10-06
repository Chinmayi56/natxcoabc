import { useState } from "react";
import { toast } from "sonner";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import BookingChat from "@/components/shared/BookingChat";
import {
  CalendarCheck, CheckCircle2, Clock, Loader2, Check, X, FileText, CalendarPlus,
  TrendingUp, Receipt, Phone, FolderOpen, ChevronRight, MessageSquare,
} from "lucide-react";

const TIMELINE = ["Pending", "Confirmed", "Running", "Completed"];

function Timeline({ status }) {
  const idx = TIMELINE.indexOf(status === "Accepted" ? "Confirmed" : status);
  const cur = idx < 0 ? 0 : idx;
  return (
    <div className="flex items-center gap-1 mt-3">
      {TIMELINE.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
          <div className={`h-6 px-2 rounded-full text-[10px] font-semibold flex items-center ${i <= cur ? "bg-royal text-white" : "bg-zinc-100 text-zinc-400"}`}>{s}</div>
          {i < TIMELINE.length - 1 && <ChevronRight className={`h-3 w-3 ${i < cur ? "text-royal" : "text-zinc-300"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function AgentBookings() {
  const { rows, loading, update } = useCrud("bookings");
  const [busy, setBusy] = useState(null);
  const [chat, setChat] = useState(null);

  const act = async (b, status, msg) => {
    setBusy(b.id);
    try {
      if (status) await update(b.id, { status });
      toast.success(msg);
    } catch (e) { toast.error("Action failed"); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <PageHeader title="Booking Management" breadcrumb={["Tax Consultant", "Bookings"]} subtitle="Accept, progress and complete the service bookings assigned to you." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Assigned" value={rows.length} icon={CalendarCheck} loading={loading} testId="ab-total" />
        <KpiCard title="Pending" value={rows.filter((r) => r.status === "Pending").length} icon={Clock} loading={loading} testId="ab-pending" />
        <KpiCard title="In Progress" value={rows.filter((r) => r.status === "Running").length} icon={Loader2} loading={loading} testId="ab-running" />
        <KpiCard title="Completed" value={rows.filter((r) => r.status === "Completed").length} icon={CheckCircle2} loading={loading} testId="ab-done" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading bookings…</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-5" data-testid="agent-bookings-grid">
          {rows.slice(0, 24).map((b) => (
            <div key={b.id} className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid={`ab-card-${b.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-bold text-zinc-900">{b.customer}</p>
                  <p className="text-sm text-muted-foreground">{b.service}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge value={b.status} />
                  <PriorityBadge value={b.priority} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-muted-foreground">
                <div><span className="block text-zinc-400">Booking</span>{b.booking_no}</div>
                <div><span className="block text-zinc-400">Due</span>{b.due_date || "TBD"}</div>
                <div><span className="block text-zinc-400">Payment</span>{b.payment_status}</div>
              </div>
              <Timeline status={b.status} />
              <div className="flex flex-wrap gap-1.5 mt-4">
                <Button size="sm" className="bg-royal text-white hover:bg-royal-hover h-8" disabled={busy === b.id} onClick={() => act(b, "Confirmed", "Booking accepted")} data-testid={`ab-accept-${b.id}`}><Check className="h-3.5 w-3.5 mr-1" />Accept</Button>
                <Button size="sm" variant="outline" className="border-zinc-300 h-8" disabled={busy === b.id} onClick={() => act(b, "Running", "Marked in progress")} data-testid={`ab-progress-${b.id}`}><TrendingUp className="h-3.5 w-3.5 mr-1" />In Progress</Button>
                <Button size="sm" variant="outline" className="border-zinc-300 h-8" disabled={busy === b.id} onClick={() => act(b, "Completed", "Booking completed")} data-testid={`ab-complete-${b.id}`}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Complete</Button>
                <Button size="sm" variant="outline" className="border-red-200 text-red-600 h-8" disabled={busy === b.id} onClick={() => act(b, "Rejected", "Booking rejected")} data-testid={`ab-reject-${b.id}`}><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                <Button size="sm" variant="ghost" className="h-8 text-zinc-600" onClick={() => act(b, null, "Document request sent to customer")}><FileText className="h-3.5 w-3.5 mr-1" />Request Docs</Button>
                <Button size="sm" variant="ghost" className="h-8 text-zinc-600" onClick={() => act(b, null, "Consultation scheduled")}><CalendarPlus className="h-3.5 w-3.5 mr-1" />Schedule</Button>
                <Button size="sm" variant="ghost" className="h-8 text-zinc-600" onClick={() => act(b, null, `Invoice generated for ${b.customer}`)}><Receipt className="h-3.5 w-3.5 mr-1" />Invoice</Button>
                <Button size="sm" variant="ghost" className="h-8 text-royal" onClick={() => setChat(b)} data-testid={`ab-chat-${b.id}`}><MessageSquare className="h-3.5 w-3.5 mr-1" />Chat</Button>
                <Button size="sm" variant="ghost" className="h-8 text-zinc-600" onClick={() => act(b, null, "Contacting customer…")}><Phone className="h-3.5 w-3.5 mr-1" />Contact</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {chat && <BookingChat booking={chat} open={!!chat} onOpenChange={(o) => !o && setChat(null)} />}
    </div>
  );
}
