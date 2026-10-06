export function StatusBadge({ value }) {
  const v = String(value || "").toLowerCase();
  const map = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    present: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    running: "bg-blue-50 text-blue-700 border-blue-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    open: "bg-blue-50 text-blue-700 border-blue-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
    "on leave": "bg-amber-50 text-amber-700 border-amber-200",
    overdue: "bg-red-50 text-red-700 border-red-200",
    absent: "bg-red-50 text-red-700 border-red-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
    confirmed: "bg-sky-50 text-sky-700 border-sky-200",
    inactive: "bg-zinc-100 text-zinc-500 border-zinc-200",
    lost: "bg-red-50 text-red-700 border-red-200",
    tds: "bg-purple-50 text-purple-700 border-purple-200",
    "income tax": "bg-orange-50 text-orange-700 border-orange-200",
    accounting: "bg-teal-50 text-teal-700 border-teal-200",
    roc: "bg-teal-50 text-teal-700 border-teal-200",
    gst: "bg-blue-50 text-blue-700 border-blue-200",
  };
  const cls = map[v] || "bg-zinc-100 text-zinc-600 border-zinc-200";
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{value}</span>;
}

export function PriorityBadge({ value }) {
  const v = String(value || "").toLowerCase();
  const map = { high: "bg-red-50 text-red-600 border-red-200", medium: "bg-amber-50 text-amber-600 border-amber-200", low: "bg-zinc-100 text-zinc-500 border-zinc-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${map[v] || map.low}`}>{value}</span>;
}
