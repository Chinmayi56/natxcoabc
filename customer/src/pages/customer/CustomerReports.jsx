import { motion } from "framer-motion";
import api from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, FileType, Printer, BarChart3 } from "lucide-react";
import { exportPDF, exportExcel, exportCSV, printRows } from "@/lib/exports";
import { toast } from "sonner";

const REPORTS = [
  { title: "GST Return Report", endpoint: "gst", columns: [{ key: "return_type", label: "Return" }, { key: "period", label: "Period" }, { key: "due_date", label: "Due" }, { key: "status", label: "Status" }] },
  { title: "Income Tax Report", endpoint: "itr", columns: [{ key: "ay", label: "AY" }, { key: "return_no", label: "Return" }, { key: "due_date", label: "Due" }, { key: "status", label: "Status" }] },
  { title: "TDS Report", endpoint: "tds", columns: [{ key: "form", label: "Form" }, { key: "quarter", label: "Quarter" }, { key: "due_date", label: "Due" }, { key: "status", label: "Status" }] },
  { title: "Invoice Report", endpoint: "invoices", columns: [{ key: "invoice_no", label: "Invoice" }, { key: "total", label: "Total" }, { key: "payment_status", label: "Payment" }] },
  { title: "Project Report", endpoint: "projects", columns: [{ key: "project_id", label: "ID" }, { key: "name", label: "Project" }, { key: "progress", label: "Progress" }, { key: "status", label: "Status" }] },
  { title: "Document Report", endpoint: "documents", columns: [{ key: "name", label: "Document" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }] },
];

export default function CustomerReports() {
  const run = async (report, fmt) => {
    try {
      const { data } = await api.get(`/${report.endpoint}`);
      const rows = data.data || [];
      if (fmt === "pdf") exportPDF(report.title, report.columns, rows);
      else if (fmt === "excel") exportExcel(report.title, report.columns, rows);
      else if (fmt === "csv") exportCSV(report.title, report.columns, rows);
      else printRows(report.title, report.columns, rows);
      toast.success(`${report.title} exported`);
    } catch (e) { toast.error("Export failed"); }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader title="Reports" breadcrumb={["Customer", "Reports"]} subtitle="Download your compliance, invoice and project reports as PDF, Excel or CSV." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORTS.map((r, i) => (
          <motion.div key={r.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid={`creport-${i}`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-royal-faint flex items-center justify-center text-royal"><BarChart3 className="h-5 w-5" /></div>
              <h3 className="font-heading text-base font-semibold text-zinc-900">{r.title}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => run(r, "pdf")} data-testid={`cpdf-${i}`}><FileText className="h-4 w-4 mr-1.5 text-red-500" />PDF</Button>
              <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => run(r, "excel")}><FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />Excel</Button>
              <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => run(r, "csv")}><FileType className="h-4 w-4 mr-1.5 text-blue-500" />CSV</Button>
              <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => run(r, "print")}><Printer className="h-4 w-4 mr-1.5" />Print</Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
