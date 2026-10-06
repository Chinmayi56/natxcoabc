import { useState } from "react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import BookServiceModal from "@/components/shared/BookServiceModal";
import ServiceTrackingModal from "@/components/shared/ServiceTrackingModal";
import { CalendarCheck, CheckCircle2, Clock, Loader2, Plus, ListChecks } from "lucide-react";

// "My Services": every service the logged-in customer has booked, with its
// live status/payment/consultant pulled straight from MongoDB via GET
// /api/bookings (server-side scoped to this customer's customer_id) — no
// MongoDB data, so it survives refresh and re-login.
export default function CustomerBookings() {
  const { rows, loading } = useCrud("bookings");
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState(null);

  const sorted = [...rows].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const columns = [
    { key: "booking_no", label: "Booking" },
    { key: "service", label: "Service" },
    { key: "assigned_agent", label: "Consultant" },
    { key: "booking_date", label: "Booked" },
    { key: "due_date", label: "Due" },
    { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} /> },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "payment_status", label: "Payment", render: (r) => <StatusBadge value={r.payment_status} /> },
    {
      key: "actions", label: "Actions", render: (r) => (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="border-zinc-300 h-8" onClick={() => setTrack(r.id)} data-testid={`track-${r.id}`}><ListChecks className="h-3.5 w-3.5 mr-1" />Track</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader
        title="My Services"
        breadcrumb={["Customer", "My Services"]}
        subtitle="The complete lifecycle and status of every service you've booked."
        actions={<Button className="bg-royal text-white hover:bg-royal-hover font-semibold" onClick={() => setOpen(true)} data-testid="new-booking-btn"><Plus className="h-4 w-4 mr-1.5" />Book a Service</Button>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Services" value={rows.length} icon={CalendarCheck} loading={loading} testId="bk-total" />
        <KpiCard title="Completed" value={rows.filter((r) => r.status === "Completed").length} icon={CheckCircle2} loading={loading} testId="bk-done" />
        <KpiCard title="In Progress" value={rows.filter((r) => ["Running", "Confirmed", "Processing"].includes(r.status)).length} icon={Loader2} loading={loading} testId="bk-running" />
        <KpiCard title="Pending" value={rows.filter((r) => r.status === "Pending").length} icon={Clock} loading={loading} testId="bk-pending" />
      </div>
      <DataTable title="My Services" columns={columns} rows={sorted} loading={loading} pageSize={8} testId="customer-bookings-table" />
      <BookServiceModal open={open} onOpenChange={setOpen} />
      <ServiceTrackingModal bookingId={track} open={!!track} onOpenChange={(o) => !o && setTrack(null)} />
    </div>
  );
}
