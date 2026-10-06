import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";

const DEPTS = ["GST Services", "Income Tax", "Accounting", "Payroll", "Audit", "ROC Compliance"];
const STATUS = ["Active", "On Leave", "Inactive"];

export default function EmployeeManagement() {
  return (
    <CrudModule
      title="Employees"
      singular="Employee"
      name="employees"
      breadcrumb={["Super Admin", "Employees"]}
      columns={[
        { key: "emp_id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        { key: "designation", label: "Designation" },
        { key: "mobile", label: "Mobile" },
        { key: "assigned_clients", label: "Clients" },
        { key: "attendance_pct", label: "Attendance %", render: (r) => `${r.attendance_pct}%` },
        { key: "performance", label: "Perf.", render: (r) => `${r.performance}/100` },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "emp_id", label: "Employee ID", required: true },
        { key: "name", label: "Full Name", required: true },
        { key: "email", label: "Email" },
        { key: "password", label: "Password (optional)", type: "password" },
        { key: "mobile", label: "Mobile" },
        { key: "department", label: "Department", type: "select", options: DEPTS },
        { key: "designation", label: "Designation" },
        { key: "manager", label: "Reporting Manager" },
        { key: "salary", label: "Salary (₹)", type: "number" },
        { key: "assigned_clients", label: "Assigned Clients", type: "number" },
        { key: "assigned_projects", label: "Assigned Projects", type: "number" },
        { key: "attendance_pct", label: "Attendance %", type: "number" },
        { key: "performance", label: "Performance Score", type: "number" },
        { key: "pan", label: "PAN" },
        { key: "state", label: "State" },
        { key: "status", label: "Status", type: "select", options: STATUS },
        { key: "address", label: "Address", full: true },
      ]}
      detailFields={["emp_id", "name", "email", "mobile", "department", "designation", "manager", "salary", "assigned_clients", "assigned_projects", "attendance_pct", "present_days", "absent_days", "late", "leaves", "performance", "pan", "state", "address", "status"]}
    />
  );
}
