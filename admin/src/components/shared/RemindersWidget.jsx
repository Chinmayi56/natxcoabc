import { useState, useEffect } from "react";
import api from "@/lib/api";
import { CalendarClock, AlertTriangle, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const TYPE = {
  urgent: { cls: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  warning: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Zap },
  information: { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Info },
};

export default function RemindersWidget({ title = "Upcoming Due Dates & Reminders", limit = 8, showSummary = true }) {
  const [data, setData] = useState({ reminders: [], summary: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/reminders"); setData(r.data.data); }
      catch (e) { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const items = data.reminders.slice(0, limit);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid="reminders-widget">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="h-5 w-5 text-brand-hover" />
        <h3 className="font-heading text-base font-semibold text-zinc-900">{title}</h3>
      </div>
      {showSummary && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[["Today", data.summary.today], ["This Week", data.summary.this_week], ["Overdue", data.summary.overdue], ["Upcoming", data.summary.upcoming]].map(([l, v]) => (
            <div key={l} className="text-center bg-zinc-50 border border-zinc-100 rounded-lg py-2">
              <p className="font-heading text-lg font-bold text-zinc-900">{v ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No upcoming reminders 🎉</p>
        ) : items.map((r, i) => {
          const t = TYPE[r.type] || TYPE.information;
          const Icon = t.icon;
          return (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors" data-testid={`reminder-${i}`}>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center border ${t.cls}`}><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800 truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">{r.company} · {r.kind} · due {r.due_date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-semibold ${r.days_remaining < 0 ? "text-red-600" : r.days_remaining <= 3 ? "text-amber-600" : "text-zinc-600"}`}>
                  {r.days_remaining < 0 ? `${Math.abs(r.days_remaining)}d overdue` : `${r.days_remaining}d left`}
                </p>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-brand-hover px-2" onClick={() => toast.success(`Reminder acknowledged: ${r.title}`)} data-testid={`remind-action-${i}`}>Action</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
