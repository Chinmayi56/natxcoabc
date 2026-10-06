import CrudModule from "@/components/shared/CrudModule";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, CheckCircle2, Clock, PlayCircle } from "lucide-react";

const STATUS = ["Pending", "Running", "Completed"];
const PRIORITY = ["Low", "Medium", "High"];

export default function Tasks() {
  return (
    <CrudModule
      title="Tasks" singular="Task" name="tasks" breadcrumb={["Employee", "Tasks"]}
      kpiFn={(r) => [
        { title: "Total Tasks", value: r.length, icon: ClipboardList },
        { title: "Completed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2 },
        { title: "In Progress", value: r.filter((x) => x.status === "Running").length, icon: PlayCircle },
        { title: "Pending", value: r.filter((x) => x.status === "Pending").length, icon: Clock },
      ]}
      columns={[
        { key: "title", label: "Task" },
        { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} /> },
        { key: "due_date", label: "Due" },
        { key: "progress", label: "Progress", render: (r) => (
          <div className="flex items-center gap-2 min-w-[120px]"><Progress value={r.progress} className="h-2 bg-zinc-100 [&>div]:bg-brand" /><span className="text-xs w-9 text-right">{r.progress}%</span></div>
        ) },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "title", label: "Task Title", required: true, full: true },
        { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium" },
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "progress", label: "Progress %", type: "number", default: 0 },
        { key: "status", label: "Status", type: "select", options: STATUS, default: "Pending" },
      ]}
    />
  );
}
