import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileCheck2, CheckCircle2, Clock } from "lucide-react";

export default function CustomerTds() {
  const { rows, loading } = useCrud("tds");
  const columns = [
    { key: "form", label: "Form" },
    { key: "quarter", label: "Quarter" },
    { key: "fy", label: "FY" },
    { key: "due_date", label: "Due Date" },
    { key: "filed_date", label: "Filed" },
    { key: "challan", label: "Challan" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader title="TDS Returns" breadcrumb={["Customer", "TDS"]} subtitle="Track your quarterly TDS filings and challans." />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Filings" value={rows.length} icon={FileCheck2} loading={loading} testId="tds-total" />
        <KpiCard title="Completed" value={rows.filter((r) => r.status === "Completed").length} icon={CheckCircle2} loading={loading} testId="tds-done" />
        <KpiCard title="Pending" value={rows.filter((r) => r.status !== "Completed").length} icon={Clock} loading={loading} testId="tds-pending" />
      </div>
      <DataTable title="TDS Returns" columns={columns} rows={rows} loading={loading} pageSize={8} testId="customer-tds-table" />
    </div>
  );
}
