import { useState } from "react";
import { LayoutGrid, List, GitBranch, Plus } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const COLUMNS_KANBAN = ["Pending", "Running", "Completed"];
const STAGES = ["Service Booked", "Documents Uploaded", "Employee Assigned", "CA Verification", "Processing", "GST Filing", "Quality Review", "Completed"];

function ProgressBar({ value }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={value} className="h-2 bg-zinc-100 [&>div]:bg-brand" />
      <span className="text-xs font-medium text-zinc-600 w-9 text-right">{value}%</span>
    </div>
  );
}

function ProjectCard({ p, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow" data-testid={`project-card-${p.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-zinc-900 truncate">{p.name}</p>
          <p className="text-xs text-muted-foreground">{p.project_id} · {p.client}</p>
        </div>
        <PriorityBadge value={p.priority} />
      </div>
      <div className="mt-3"><ProgressBar value={p.progress} /></div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
        <span className="text-xs text-zinc-500">{p.assigned_employee}</span>
        <span className="text-xs font-medium text-zinc-600">Due {p.due_date}</span>
      </div>
    </motion.div>
  );
}

export default function Projects() {
  const { rows, loading, create } = useCrud("projects");
  const [form, setForm] = useState({ name: "", client: "", service_type: "", status: "Pending", priority: "Medium", progress: 0, due_date: "", assigned_employee: "" });
  const [showForm, setShowForm] = useState(false);
  const submit = async (e) => { e.preventDefault(); if (!form.name.trim()) return; await create({ ...form, project_id: `PRJ-${Date.now()}` }); setForm({ name: "", client: "", service_type: "", status: "Pending", priority: "Medium", progress: 0, due_date: "", assigned_employee: "" }); setShowForm(false); };
  const [view, setView] = useState("kanban");

  const columns = [
    { key: "project_id", label: "ID" },
    { key: "name", label: "Project" },
    { key: "service_type", label: "Service" },
    { key: "client", label: "Client" },
    { key: "assigned_employee", label: "Employee" },
    { key: "priority", label: "Priority", render: (r) => <PriorityBadge value={r.priority} /> },
    { key: "progress", label: "Progress", render: (r) => <ProgressBar value={r.progress} /> },
    { key: "due_date", label: "Due" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];

  const ViewBtn = ({ id, icon: Icon, label }) => (
    <Button variant={view === id ? "default" : "outline"} size="sm" className={view === id ? "bg-brand text-zinc-900 hover:bg-brand-hover" : "border-zinc-300"} onClick={() => setView(id)} data-testid={`view-${id}`}>
      <Icon className="h-4 w-4 mr-1.5" />{label}
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Projects"
        breadcrumb={["Super Admin", "Projects"]}
        subtitle="Track GST, tax, accounting & compliance projects."
        actions={<div className="flex gap-2"><Button className="bg-royal text-white" onClick={() => setShowForm(v => !v)}><Plus className="h-4 w-4 mr-1.5" />Add project</Button><ViewBtn id="kanban" icon={LayoutGrid} label="Kanban" /><ViewBtn id="list" icon={List} label="List" /><ViewBtn id="timeline" icon={GitBranch} label="Timeline" /></div>}
      />

      {showForm && <form onSubmit={submit} className="mb-6 bg-white border border-zinc-200 rounded-xl p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"><input className="border rounded-md p-2" placeholder="Project name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /><input className="border rounded-md p-2" placeholder="Client" value={form.client} onChange={e=>setForm({...form,client:e.target.value})} /><input className="border rounded-md p-2" placeholder="Service" value={form.service_type} onChange={e=>setForm({...form,service_type:e.target.value})} /><input className="border rounded-md p-2" placeholder="Assigned employee" value={form.assigned_employee} onChange={e=>setForm({...form,assigned_employee:e.target.value})} /><input className="border rounded-md p-2" type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} /><select className="border rounded-md p-2" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option>Low</option><option>Medium</option><option>High</option></select><div className="sm:col-span-2 lg:col-span-3 flex gap-2"><Button type="submit" className="bg-royal text-white">Save project</Button><Button type="button" variant="outline" onClick={()=>setShowForm(false)}>Cancel</Button></div></form>}

      {view === "list" && <DataTable title="Projects" columns={columns} rows={rows} loading={loading} pageSize={8} testId="projects-table" />}

      {view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="kanban-board">
          {COLUMNS_KANBAN.map((col) => {
            const items = rows.filter((r) => r.status === col);
            return (
              <div key={col} className="bg-zinc-100/60 rounded-xl p-3">
                <div className="flex items-center justify-between px-1 mb-3">
                  <h3 className="font-heading text-sm font-semibold text-zinc-800">{col}</h3>
                  <span className="text-xs font-medium text-zinc-500 bg-white px-2 py-0.5 rounded-full border border-zinc-200">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {loading ? <Skeleton className="h-28 w-full rounded-xl" /> : items.map((p, i) => <ProjectCard key={p.id} p={p} i={i} />)}
                  {!loading && items.length === 0 && <p className="text-xs text-zinc-400 text-center py-6">No projects</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "timeline" && (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-6" data-testid="timeline-view">
          <div className="space-y-6">
            {rows.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-brand ring-4 ring-brand-faint" />
                  {i < rows.length - 1 && <div className="w-px flex-1 bg-zinc-200 mt-1" />}
                </div>
                <div className="pb-2 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-heading text-sm font-semibold text-zinc-900">{p.name}</p>
                    <StatusBadge value={p.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.client} · Stage: <b className="text-zinc-700">{p.stage}</b> · Due {p.due_date}</p>
                  <div className="mt-2 max-w-xs"><ProgressBar value={p.progress} /></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
