import { motion } from "framer-motion";
import { Clock, CalendarDays } from "lucide-react";

export function ActivityFeed({ items }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid="activity-feed">
      <h3 className="font-heading text-base font-semibold text-zinc-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {items.map((a, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-3">
            <div className="mt-1 h-2 w-2 rounded-full bg-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-zinc-800 truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{a.time}</p>
            </div>
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-brand-hover bg-brand-faint px-2 py-0.5 rounded h-fit">{a.tag}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function DueDatesWidget({ items }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid="due-dates-widget">
      <h3 className="font-heading text-base font-semibold text-zinc-900 mb-4">Upcoming Due Dates</h3>
      <div className="space-y-3">
        {items.map((d, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 transition-colors">
            <div className="h-9 w-9 rounded-lg bg-brand-faint flex items-center justify-center text-brand-hover shrink-0">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-zinc-800 truncate">{d.title}</p>
              <p className="text-xs text-muted-foreground">{d.date}</p>
            </div>
            <span className="ml-auto text-[10px] font-semibold text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded">{d.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
