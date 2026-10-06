import { useMemo, useState } from "react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, CheckCircle2, XCircle, Clock, Coffee, PlaneTakeoff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api, { describeApiError } from "@/lib/api";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Attendance() {
  const { rows, loading, load } = useCrud("attendance");
  const [submitting, setSubmitting] = useState(false);

  const todayRow = useMemo(() => rows.find((r) => r.date === todayIso()), [rows]);
  const checkedIn = !!todayRow && (!todayRow.check_out || todayRow.check_out === "-");
  const checkedOutToday = !!todayRow && todayRow.check_out && todayRow.check_out !== "-";

  const handleCheckIn = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/attendance", {});
      toast.success(data?.message === "You have already checked in today" ? data.message : `Checked in at ${data?.data?.check_in || ""}`);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Check-in failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayRow) return;
    setSubmitting(true);
    try {
      const { data } = await api.put(`/attendance/${todayRow.id}`, {});
      toast.success(data?.message === "You have already checked out today" ? data.message : `Checked out at ${data?.data?.check_out || ""}`);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Check-out failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const presentDays = rows.filter((r) => r.status === "Present").length;
  const absentDays = rows.filter((r) => r.status === "Absent").length;
  const lateDays = rows.filter((r) => r.status === "Late").length;
  const halfDays = rows.filter((r) => r.status === "Half Day").length;
  const leaveDays = rows.filter((r) => r.status === "Leave").length;
  const totalMinutes = rows.reduce((sum, r) => {
    const m = String(r.hours || "").match(/(\d+)h\s*(\d+)?/);
    if (!m) return sum;
    return sum + Number(m[1]) * 60 + Number(m[2] || 0);
  }, 0);

  const kpis = [
    { title: "Present Days", value: presentDays, icon: CheckCircle2 },
    { title: "Absent Days", value: absentDays, icon: XCircle },
    { title: "Late Entries", value: lateDays, icon: Clock },
    { title: "Half Days", value: halfDays, icon: Coffee },
    { title: "Leave Days", value: leaveDays, icon: PlaneTakeoff },
    { title: "Working Hours", value: `${Math.floor(totalMinutes / 60)}h`, icon: Clock },
  ];

  const columns = [
    { key: "date", label: "Date" },
    { key: "check_in", label: "Check In" },
    { key: "check_out", label: "Check Out" },
    { key: "hours", label: "Total Hours" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Attendance" breadcrumb={["Employee", "Attendance"]} subtitle="Daily check-in / check-out and monthly history." />
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Today · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
          <p className="font-heading text-xl font-bold text-zinc-900 mt-1">
            {checkedOutToday ? `Checked out at ${todayRow.check_out}` : checkedIn ? `Checked in at ${todayRow.check_in}` : "Not checked in yet"}
          </p>
        </div>
        {!checkedIn && !checkedOutToday ? (
          <Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={handleCheckIn} disabled={submitting} data-testid="check-in-btn">
            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <LogIn className="h-4 w-4 mr-1.5" />}
            {submitting ? "Checking In..." : "Check In"}
          </Button>
        ) : checkedIn ? (
          <Button className="bg-zinc-900 text-white hover:bg-zinc-800 font-semibold" onClick={handleCheckOut} disabled={submitting} data-testid="check-out-btn">
            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <LogOut className="h-4 w-4 mr-1.5" />}
            {submitting ? "Checking Out..." : "Check Out"}
          </Button>
        ) : (
          <Button disabled variant="outline" className="border-zinc-300 text-zinc-500">Day complete</Button>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map((k, i) => <KpiCard key={i} {...k} loading={loading} testId={`att-kpi-${i}`} />)}
      </div>
      <DataTable title="Attendance History" columns={columns} rows={rows} loading={loading} pageSize={8} testId="attendance-table" />
    </div>
  );
}
