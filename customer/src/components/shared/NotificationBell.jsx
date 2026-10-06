import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2, Search, AlertTriangle, Info, Zap } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ICON = { urgent: AlertTriangle, warning: Zap, information: Info };
const COLOR = { urgent: "text-red-600 bg-red-50", warning: "text-amber-600 bg-amber-50", information: "text-royal bg-royal-faint" };

export default function NotificationBell({ base = "/admin" }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try { const { data } = await api.get("/notifications"); setItems(data.data.notifications); setUnread(data.data.unread); } catch (e) {}
  }, []);
  useEffect(() => { load(); const timer = window.setInterval(load, 15000); return () => window.clearInterval(timer); }, [load]);

  const readOne = async (id) => { await api.post(`/notifications/${id}/read`); load(); };
  const readAll = async () => { await api.post("/notifications/read-all"); load(); };
  const del = async (id) => { await api.delete(`/notifications/${id}`); load(); };

  const filtered = items.filter((n) => `${n.title} ${n.category}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group text-white bg-[#1E40AF] hover:bg-[#2563EB] hover:text-white duration-200" data-testid="notification-bell">
          <Bell className={`h-5 w-5 text-white ${unread > 0 ? "group-hover:animate-[fade-up_0.4s_ease]" : ""}`} />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-zinc-900 text-[10px] font-bold flex items-center justify-center ring-2 ring-[#1E40AF] animate-pulse" data-testid="notif-badge">{unread > 99 ? "99+" : unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 bg-white p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <p className="font-heading font-semibold text-zinc-900">Notifications {unread > 0 && <span className="text-xs text-royal">({unread} new)</span>}</p>
          <button onClick={readAll} className="text-xs font-medium text-royal hover:underline" data-testid="mark-all-read">Mark all read</button>
        </div>
        <div className="p-2 border-b border-zinc-100">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notifications..." className="pl-8 h-8 text-sm border-zinc-200" data-testid="notif-search" /></div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No notifications</p> : filtered.map((n) => {
            const Ic = ICON[n.type] || Info;
            return (
              <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 ${!n.read ? "bg-brand-faint/40" : ""}`} data-testid={`notif-item-${n.id}`}>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${COLOR[n.type] || COLOR.information}`}><Ic className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800 truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.category} · {n.priority}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {!n.read && <button onClick={() => readOne(n.id)} title="Mark read" data-testid={`notif-read-${n.id}`}><Check className="h-3.5 w-3.5 text-zinc-400 hover:text-royal" /></button>}
                  <button onClick={() => del(n.id)} title="Delete" data-testid={`notif-del-${n.id}`}><Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" /></button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2.5 border-t border-zinc-100 text-center">
          <button onClick={() => navigate(`${base}/notifications`)} className="text-sm font-medium text-royal hover:underline" data-testid="view-all-notifs">View all notifications</button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
