import { useCrud } from "@/hooks/useCrud";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportPDF } from "@/lib/exports";
import { inr } from "@/lib/utils";
import { toast } from "sonner";

export default function Payslips() {
  const { rows, loading } = useCrud("payslips");
  const { user } = useAuth();
  const empLabel = `${user?.name || "Employee"}${user?.meta?.employee_id ? ` (${user.meta.employee_id})` : ""}`;

  const download = (p) => {
    exportPDF(`Payslip ${p.month}`, [{ key: "k", label: "Component" }, { key: "v", label: "Amount" }], [
      { k: "Employee", v: empLabel },
      { k: "Month", v: p.month },
      { k: "Gross Earnings", v: inr(p.gross) },
      { k: "Deductions", v: inr(p.deductions) },
      { k: "Net Salary", v: inr(p.net) },
    ]);
    toast.success(`Payslip ${p.month} downloaded`);
  };

  const columns = [
    { key: "month", label: "Month" },
    { key: "gross", label: "Gross", render: (r) => inr(r.gross), exportValue: (r) => r.gross },
    { key: "deductions", label: "Deductions", render: (r) => inr(r.deductions), exportValue: (r) => r.deductions },
    { key: "net", label: "Net Salary", render: (r) => inr(r.net), exportValue: (r) => r.net },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "actions", label: "Actions", render: (r) => (
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => download(r)} data-testid={`payslip-${r.id}`}><Download className="h-4 w-4 text-brand-hover" /></Button>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Payslips" breadcrumb={["Employee", "Payslips"]} subtitle="Download your monthly payslips." />
      <DataTable title="Payslips" columns={columns} rows={rows} loading={loading} pageSize={8} testId="payslips-table" />
    </div>
  );
}
