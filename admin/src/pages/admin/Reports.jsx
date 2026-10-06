import { motion } from "framer-motion";
import api from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, FileType, Printer, BarChart3 } from "lucide-react";
import { exportPDF, exportExcel, exportCSV, printRows } from "@/lib/exports";
import { toast } from "sonner";

const REPORTS = [
  { title: "Revenue Report", endpoint: "invoices", columns: [{ key: "invoice_no", label: "Invoice" }, { key: "customer", label: "Customer" }, { key: "total", label: "Total" }, { key: "payment_status", label: "Status" }] },
  { title: "Customer Report", endpoint: "customers", columns: [{ key: "cust_id", label: "ID" }, { key: "business_name", label: "Business" }, { key: "gst_number", label: "GSTIN" }, { key: "state", label: "State" }, { key: "status", label: "Status" }] },
  { title: "Employee Report", endpoint: "employees", columns: [{ key: "emp_id", label: "ID" }, { key: "name", label: "Name" }, { key: "department", label: "Dept" }, { key: "performance", label: "Performance" }, { key: "status", label: "Status" }] },
  { title: "Project Report", endpoint: "projects", columns: [{ key: "project_id", label: "ID" }, { key: "name", label: "Project" }, { key: "client", label: "Client" }, { key: "progress", label: "Progress" }, { key: "status", label: "Status" }] },
  { title: "GST Report", endpoint: "gst", columns: [{ key: "return_type", label: "Return" }, { key: "client", label: "Client" }, { key: "period", label: "Period" }, { key: "status", label: "Status" }] },
  { title: "Income Tax Report", endpoint: "itr", columns: [{ key: "client", label: "Client" }, { key: "ay", label: "AY" }, { key: "return_no", label: "Return" }, { key: "status", label: "Status" }] },
  { title: "Booking Report", endpoint: "bookings", columns: [{ key: "booking_no", label: "Booking" }, { key: "customer", label: "Customer" }, { key: "service", label: "Service" }, { key: "status", label: "Status" }] },
  { title: "Invoice Report", endpoint: "invoices", columns: [{ key: "invoice_no", label: "Invoice" }, { key: "taxable", label: "Taxable" }, { key: "total", label: "Total" }, { key: "payment_status", label: "Payment" }] },
];

export default function Reports() {
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
    <div>
      <PageHeader title="Reports" breadcrumb={["Super Admin", "Reports"]} subtitle="Generate and export business reports as PDF, Excel or CSV." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORTS.map((r, i) => (
          <motion.div key={r.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid={`report-${i}`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-brand-faint flex items-center justify-center text-brand-hover"><BarChart3 className="h-5 w-5" /></div>
              <h3 className="font-heading text-base font-semibold text-zinc-900">{r.title}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => run(r, "pdf")} data-testid={`pdf-${i}`}><FileText className="h-4 w-4 mr-1.5 text-red-500" />PDF</Button>
              <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => run(r, "excel")} data-testid={`excel-${i}`}><FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />Excel</Button>
              <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => run(r, "csv")} data-testid={`csv-${i}`}><FileType className="h-4 w-4 mr-1.5 text-blue-500" />CSV</Button>
              <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => run(r, "print")} data-testid={`print-${i}`}><Printer className="h-4 w-4 mr-1.5" />Print</Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
