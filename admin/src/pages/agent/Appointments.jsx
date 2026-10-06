import { useEffect, useState } from "react";
import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CalendarCheck, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import api from "@/lib/api";

// Fallback only — used if the live service catalog can't be reached yet.
const DEFAULT_SERVICES = ["GST Registration", "Company Registration", "Accounting", "Income Tax", "Audit", "ROC Compliance"];
const MODES = ["Office", "Online", "Phone"];
const STATUS = ["Upcoming", "Completed", "Cancelled"];

export default function Appointments() {
  // "Service Type" reflects the live Admin-managed service catalog — a
  // service Admin just added is selectable here immediately, no code change.
  const [services, setServices] = useState(DEFAULT_SERVICES);
  useEffect(() => {
    api.get("/services").then(({ data }) => {
      const names = (Array.isArray(data?.data) ? data.data : []).map((s) => s.title || s.name).filter(Boolean);
      if (names.length) setServices(names);
    }).catch(() => {});
  }, []);
  return (
    <CrudModule
      title="Appointments" singular="Appointment" name="appointments" breadcrumb={["Tax Consultant", "Appointments"]}
      kpiFn={(r) => [
        { title: "Total", value: r.length, icon: CalendarCheck },
        { title: "Upcoming", value: r.filter((x) => x.status === "Upcoming").length, icon: CalendarClock },
        { title: "Completed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 },
        { title: "Cancelled", value: r.filter((x) => x.status === "Cancelled").length, icon: XCircle },
      ]}
      columns={[
        { key: "meeting_id", label: "ID" },
        { key: "business_name", label: "Business" },
        { key: "date", label: "Date" },
        { key: "time", label: "Time" },
        { key: "service", label: "Service" },
        { key: "mode", label: "Mode" },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "business_name", label: "Business Name", required: true },
        { key: "date", label: "Meeting Date", type: "date", required: true },
        { key: "time", label: "Meeting Time" },
        { key: "service", label: "Service Type", type: "select", options: services },
        { key: "mode", label: "Meeting Mode", type: "select", options: MODES, default: "Online" },
        { key: "status", label: "Status", type: "select", options: STATUS, default: "Upcoming" },
      ]}
    />
  );
}
