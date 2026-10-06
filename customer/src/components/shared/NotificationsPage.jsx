import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Bell, BellRing, AlertTriangle, Zap, Info, Check, Trash2, Search, CheckCheck,
  Archive, Download, ChevronLeft, ChevronRight, ArrowRight,
} from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportCSV } from "@/lib/exports";

const ICON = { urgent: AlertTriangle, warning: Zap, information: Info };
const COLOR = { urgent: "text-red-600 bg-red-50", warning: "text-amber-600 bg-amber-50", information: "text-royal bg-royal-faint" };

function timeAgo(ts) {
  try {
    const d = new Date(ts); const s = (Date.now() - d.getTime()) / 1000;
    if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  } catch { return ""; }
}

export default function NotificationsPage({ base = "/admin", portal = "Super Admin", padded = false }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 8;

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/notifications"); setItems(data.data.notifications || []); }
    catch (e) { toast.error("Failed to load notifications"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const readOne = async (id) => { await api.post(`/notifications/${id}/read`); load(); };
  const readAll = async () => { await api.post("/notifications/read-all"); toast.success("All marked as read"); load(); };
  const del = async (id) => { await api.delete(`/notifications/${id}`); toast.success("Notification deleted"); load(); };
  const archive = (id) => { setItems((s) => s.filter((n) => n.id !== id)); toast.success("Archived"); };

  const filtered = useMemo(() => {
    let out = items;
    if (filter === "unread") out = out.filter((n) => !n.read);
    else if (filter !== "all") out = out.filter((n) => n.type === filter);
    if (q.trim()) { const s = q.toLowerCase(); out = out.filter((n) => `${n.title} ${n.category} ${n.description}`.toLowerCase().includes(s)); }
    return out;
  }, [items, filter, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const unread = items.filter((n) => !n.read).length;
  const urgent = items.filter((n) => n.type === "urgent").length;
  const week = items.filter((n) => n.type !== "information").length;

  const doExport = () => { exportCSV("Notifications", [{ key: "title", label: "Title" }, { key: "category", label: "Category" }, { key: "priority", label: "Priority" }, { key: "type", label: "Type" }], filtered); toast.success("Exported"); };

  return (
    <div className={padded ? "max-w-6xl mx-auto px-6 py-8" : ""}>
      <PageHeader
        title="Notification Center"
        breadcrumb={[portal, "Notifications"]}
        subtitle="Stay on top of compliance deadlines, payments, documents and system alerts."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-zinc-300" onClick={doExport} data-testid="notif-export"><Download className="h-4 w-4 mr-1.5" />Export</Button>
            <Button className="bg-royal text-white hover:bg-royal-hover font-semibold" onClick={readAll} data-testid="notif-mark-all"><CheckCheck className="h-4 w-4 mr-1.5" />Mark all read</Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total" value={items.length} icon={Bell} loading={loading} testId="notif-kpi-total" />
        <KpiCard title="Unread" value={unread} icon={BellRing} loading={loading} testId="notif-kpi-unread" />
        <KpiCard title="Urgent" value={urgent} icon={AlertTriangle} loading={loading} testId="notif-kpi-urgent" />
        <KpiCard title="Action Needed" value={week} icon={Zap} loading={loading} testId="notif-kpi-action" />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search notifications..." className="pl-9 border-zinc-300" data-testid="notif-search" />
        </div>
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48 border-zinc-300" data-testid="notif-filter"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All notifications</SelectItem>
            <SelectItem value="unread">Unread only</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="warning">Warnings</SelectItem>
            <SelectItem value="information">Information</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm divide-y divide-zinc-100" data-testid="notif-list">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Loading notifications…</div>
        ) : pageRows.length === 0 ? (
          <div className="p-12 text-center"><Bell className="h-10 w-10 text-zinc-300 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No notifications match your filters.</p></div>
        ) : pageRows.map((n) => {
          const Ic = ICON[n.type] || Info;
          return (
            <div key={n.id} className={`flex items-start gap-4 p-4 hover:bg-zinc-50/70 transition-colors ${!n.read ? "bg-royal-faint/30" : ""}`} data-testid={`notif-row-${n.id}`}>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${COLOR[n.type] || COLOR.information}`}><Ic className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-zinc-900">{n.title}</p>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-royal" />}
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${n.priority === "High" ? "bg-red-100 text-red-700" : n.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{n.priority}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                  <span>{n.category}</span><span>·</span><span>{timeAgo(n.ts)}</span>
                  <button className="inline-flex items-center gap-1 text-royal font-medium ml-1 hover:underline" data-testid={`notif-view-${n.id}`} onClick={() => toast.info(`Opening: ${n.title}`)}>View <ArrowRight className="h-3 w-3" /></button>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!n.read && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => readOne(n.id)} data-testid={`notif-read-${n.id}`} title="Mark read"><Check className="h-4 w-4 text-zinc-500" /></Button>}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => archive(n.id)} data-testid={`notif-archive-${n.id}`} title="Archive"><Archive className="h-4 w-4 text-zinc-500" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => del(n.id)} data-testid={`notif-del-${n.id}`} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="border-zinc-300" disabled={current <= 1} onClick={() => setPage(current - 1)} data-testid="notif-prev"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-3 font-medium text-zinc-700">{current} / {totalPages}</span>
            <Button variant="outline" size="sm" className="border-zinc-300" disabled={current >= totalPages} onClick={() => setPage(current + 1)} data-testid="notif-next"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
