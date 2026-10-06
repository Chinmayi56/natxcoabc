import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserCog, CheckCircle2, XCircle, UserCheck, UserX, Star } from "lucide-react";

const STATUS = ["Active", "Inactive"];
// Kept deliberately separate from `status` (account Active/Inactive) —
// this tracks today's attendance only, per the Phase 1 spec.
const ATTENDANCE = ["Present", "Absent"];

export default function AgentManagement() {
  return (
    <CrudModule
      title="Agents"
      singular="Agent"
      name="agents"
      breadcrumb={["Super Admin", "Agents"]}
      subtitle="Tax consultant directory, workload and today's attendance — live from the NTAXCO backend."
      kpiFn={(rows) => [
        { title: "Total Agents", value: rows.length, icon: UserCog, tone: "royal" },
        { title: "Present Today", value: rows.filter((r) => r.attendance_today === "Present").length, icon: UserCheck, tone: "green" },
        { title: "Absent Today", value: rows.filter((r) => r.attendance_today === "Absent").length, icon: UserX, tone: "red" },
        { title: "Active", value: rows.filter((r) => r.status === "Active").length, icon: CheckCircle2, tone: "royal" },
        { title: "Inactive", value: rows.filter((r) => r.status === "Inactive").length, icon: XCircle, tone: "grey" },
      ]}
      columns={[
        { key: "agent_id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "mobile", label: "Mobile" },
        { key: "specialization", label: "Specialization" },
        { key: "active_clients", label: "Assigned Tasks" },
        { key: "completed_tasks", label: "Completed Tasks" },
        { key: "commission_percentage", label: "Percentage", render: (r) => (r.commission_percentage != null && r.commission_percentage !== "" ? `${r.commission_percentage}%` : "—") },
        { key: "attendance_today", label: "Attendance", render: (r) => (r.attendance_today ? <StatusBadge value={r.attendance_today} /> : "—") },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "agent_id", label: "Agent ID", required: true },
        { key: "name", label: "Name", required: true, full: true },
        { key: "email", label: "Email" },
        { key: "mobile", label: "Mobile" },
        { key: "specialization", label: "Specialization" },
        { key: "experience", label: "Experience" },
        { key: "region", label: "Region" },
        { key: "active_clients", label: "Assigned Tasks", type: "number" },
        { key: "completed_tasks", label: "Completed Tasks", type: "number" },
        { key: "conversion", label: "Conversion %", type: "number" },
        { key: "commission_percentage", label: "Agent Percentage (%)", type: "number" },
        { key: "rating", label: "Rating", type: "number" },
        { key: "attendance_today", label: "Today's Attendance", type: "select", options: ATTENDANCE, default: "Present" },
        { key: "status", label: "Account Status", type: "select", options: STATUS, default: "Active" },
      ]}
      detailFields={["agent_id", "name", "email", "mobile", "specialization", "experience", "region", "active_clients", "completed_tasks", "conversion", "commission_percentage", "rating", "attendance_today", "status"]}
    relationshipEntity="agent"
    />
  );
}
