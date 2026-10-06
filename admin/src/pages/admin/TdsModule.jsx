import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileCheck2, CheckCircle2, Clock, CalendarClock } from "lucide-react";

const FORMS = ["24Q", "26Q", "27Q", "27EQ"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const STATUS = ["Pending", "Running", "Completed"];

export default function TdsModule() {
  return (
    <CrudModule
      customerService="TDS"
      title="TDS Returns" singular="TDS Return" name="tds" breadcrumb={["Super Admin", "TDS"]}
      kpiFn={(r) => [
        { title: "Total Returns", value: r.length, icon: FileCheck2 },
        { title: "Filed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 },
        { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
        { title: "In Progress", value: r.filter((x) => x.status === "Running").length, icon: CalendarClock },
      ]}
      columns={[
        { key: "client", label: "Client" },
        { key: "form", label: "Form" },
        { key: "quarter", label: "Quarter" },
        { key: "fy", label: "FY" },
        { key: "due_date", label: "Due Date" },
        { key: "filed_date", label: "Filed", render: (r) => r.filed_date || "—" },
        { key: "challan", label: "Challan" },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "client", label: "Client", required: true },
        { key: "form", label: "Form", type: "select", options: FORMS },
        { key: "quarter", label: "Quarter", type: "select", options: QUARTERS },
        { key: "fy", label: "Financial Year", default: "2026-27" },
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "filed_date", label: "Filed Date", type: "date" },
        { key: "challan", label: "Challan No" },
        { key: "status", label: "Status", type: "select", options: STATUS, default: "Pending" },
      ]}
    />
  );
}
