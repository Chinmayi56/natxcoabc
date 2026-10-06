import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlaneTakeoff, CheckCircle2, Clock, XCircle } from "lucide-react";

const TYPES = ["Casual Leave", "Sick Leave", "Earned Leave", "Work From Home"];

export default function Leave() {
  return (
    <CrudModule
      title="Leave" singular="Leave Request" name="leaves" breadcrumb={["Employee", "Leave"]}
      kpiFn={(r) => [
        { title: "Total Requests", value: r.length, icon: PlaneTakeoff },
        { title: "Approved", value: r.filter((x) => x.status === "Approved").length, icon: CheckCircle2 },
        { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
        { title: "Rejected", value: r.filter((x) => x.status === "Rejected").length, icon: XCircle },
      ]}
      columns={[
        { key: "leave_type", label: "Type" },
        { key: "from_date", label: "From" },
        { key: "to_date", label: "To" },
        { key: "days", label: "Days" },
        { key: "reason", label: "Reason" },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "leave_type", label: "Leave Type", type: "select", options: TYPES, required: true },
        { key: "from_date", label: "From Date", type: "date", required: true },
        { key: "to_date", label: "To Date", type: "date", required: true },
        { key: "days", label: "Days", type: "number", default: 1 },
        { key: "reason", label: "Reason", full: true },
      ]}
      detailFields={["leave_type", "from_date", "to_date", "days", "reason", "status"]}
    />
  );
}
