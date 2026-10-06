import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScrollText, CheckCircle2, Clock, CalendarClock } from "lucide-react";

const FORMS = ["AOC-4", "MGT-7", "DIR-3 KYC", "ADT-1", "DPT-3"];
const STATUS = ["Pending", "Running", "Completed"];

export default function RocModule() {
  return (
    <CrudModule
      customerService="ROC"
      title="ROC Compliance" singular="ROC Filing" name="roc" breadcrumb={["Super Admin", "ROC"]}
      kpiFn={(r) => [
        { title: "Total Filings", value: r.length, icon: ScrollText },
        { title: "Filed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 },
        { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
        { title: "Upcoming Due", value: r.filter((x) => x.status !== "Completed").length, icon: CalendarClock },
      ]}
      columns={[
        { key: "company", label: "Company" },
        { key: "form", label: "Form" },
        { key: "fy", label: "FY" },
        { key: "due_date", label: "Due Date" },
        { key: "filed_date", label: "Filed", render: (r) => r.filed_date || "—" },
        { key: "consultant", label: "Consultant" },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "company", label: "Company", required: true },
        { key: "form", label: "Form", type: "select", options: FORMS },
        { key: "fy", label: "Financial Year", default: "2025-26" },
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "filed_date", label: "Filed Date", type: "date" },
        { key: "consultant", label: "Consultant" },
        { key: "status", label: "Status", type: "select", options: STATUS, default: "Pending" },
      ]}
    />
  );
}
