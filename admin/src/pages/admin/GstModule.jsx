import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileText, CheckCircle2, Clock, CalendarClock } from "lucide-react";

const TYPES = ["GSTR-1", "GSTR-3B", "GSTR-9"];
const STATUS = ["Pending", "Running", "Completed"];

export default function GstModule() {
  return (
    <CrudModule
      customerService="GST"
      title="GST Returns" singular="GST Return" name="gst" breadcrumb={["Super Admin", "GST"]}
      kpiFn={(r) => [
        { title: "Total Returns", value: r.length, icon: FileText },
        { title: "Filed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 },
        { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
        { title: "In Progress", value: r.filter((x) => x.status === "Running").length, icon: CalendarClock },
      ]}
      columns={[
        { key: "return_type", label: "Return" },
        { key: "client", label: "Client" },
        { key: "customer_id", label: "Customer ID" },
        { key: "gstin", label: "GSTIN" },
        { key: "period", label: "Period" },
        { key: "due_date", label: "Due Date" },
        { key: "filed_date", label: "Filed", render: (r) => r.filed_date || "—" },
        { key: "consultant", label: "Consultant" },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "return_type", label: "Return Type", type: "select", options: TYPES, required: true },
        { key: "client", label: "Client", required: true },
        { key: "gstin", label: "GSTIN" },
        { key: "fy", label: "Financial Year", default: "2025-26" },
        { key: "period", label: "Period" },
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "filed_date", label: "Filed Date", type: "date" },
        { key: "ack", label: "Acknowledgement No" },
        { key: "consultant", label: "Consultant" },
        { key: "status", label: "Status", type: "select", options: STATUS, default: "Pending" },
      ]}
    />
  );
}
