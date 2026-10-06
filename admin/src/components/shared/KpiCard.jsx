import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Semantic icon tones shared across all dashboards, layered on top of the
// existing royal/brand palette so KpiCard stays backward compatible (any
// card that doesn't pass `tone` keeps the original royal look).
const TONES = {
  royal: "bg-royal-faint text-royal",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
  orange: "bg-orange-50 text-orange-600",
  teal: "bg-teal-50 text-teal-600",
  grey: "bg-zinc-100 text-zinc-500",
};

export function KpiCard({ title, value, icon: Icon, trend, to, loading, testId, tone = "royal" }) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5">
        <Skeleton className="h-9 w-9 rounded-lg mb-4" />
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }
  const positive = trend == null || trend >= 0;
  return (
    <button
      data-testid={testId}
      onClick={() => to && navigate(to)}
      className="text-left bg-white border border-zinc-200 rounded-xl shadow-sm p-5 transition-shadow hover:shadow-md hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/30 group"
    >
      <div className="flex items-start justify-between">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${TONES[tone] || TONES.royal}`}>
          {Icon && <Icon className="h-5 w-5" strokeWidth={2} />}
        </div>
        {trend != null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? "text-emerald-600" : "text-red-500"}`}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-4 font-heading text-2xl font-bold text-zinc-900">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground group-hover:text-zinc-700 transition-colors">{title}</div>
    </button>
  );
}
