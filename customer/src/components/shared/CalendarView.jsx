import { useState, useEffect } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const KIND_COLOR = { GST: "bg-brand", "Income Tax": "bg-blue-500", TDS: "bg-emerald-500", ROC: "bg-purple-500", Invoice: "bg-red-500" };

export default function CalendarView({ role = "employee" }) {
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(new Date());

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/reminders");
        setEvents(r.data.data.reminders.map((x) => ({ date: x.due_date, title: x.title, kind: x.kind })));
      } catch (e) {}
    })();
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const monthName = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const byDay = {};
  events.forEach((e) => { const d = new Date(e.date); if (d.getFullYear() === year && d.getMonth() === month) { (byDay[d.getDate()] = byDay[d.getDate()] || []).push(e); } });
  const upcoming = [...events].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 6);

  return (
    <div>
      <PageHeader title="Calendar" breadcrumb={[role === "agent" ? "Tax Consultant" : "Employee", "Calendar"]} subtitle="Deadlines, meetings & tax filing dates."
        actions={<div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="border-zinc-300" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-heading font-semibold text-zinc-800 w-40 text-center">{monthName}</span>
          <Button variant="outline" size="icon" className="border-zinc-300" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl shadow-sm p-4" data-testid="calendar-grid">
          <div className="grid grid-cols-7 gap-1 mb-2">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="text-center text-xs font-medium text-zinc-400 py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const evs = byDay[day] || [];
              return (
                <div key={day} className={`min-h-[64px] rounded-lg border p-1.5 ${evs.length ? "border-brand-light bg-brand-faint" : "border-zinc-100"}`}>
                  <span className="text-xs font-medium text-zinc-600">{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {evs.slice(0, 2).map((e, j) => <div key={j} className={`h-1.5 w-full rounded-full ${KIND_COLOR[e.kind] || "bg-zinc-400"}`} title={e.title} />)}
                    {evs.length > 2 && <span className="text-[9px] text-zinc-400">+{evs.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5">
          <h3 className="font-heading text-base font-semibold text-zinc-900 mb-4">Upcoming Events</h3>
          <div className="space-y-3">
            {upcoming.map((e, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${KIND_COLOR[e.kind] || "bg-zinc-400"}`} />
                <div className="min-w-0"><p className="text-sm text-zinc-800 truncate">{e.title}</p><p className="text-xs text-muted-foreground">{e.date}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
