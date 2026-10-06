// Small reusable "service-wise counts" strip used by dashboards that need a
// quick breakdown of records by service/category (e.g. Bookings). Renders
// directly from whatever rows/field it is given — no invented data.
export default function ServiceBreakdown({ rows, field = "service", title = "Service-wise Counts", testId = "service-breakdown" }) {
  const counts = (rows || []).reduce((m, r) => {
    const k = r[field] || "Other";
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-4" data-testid={testId}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">{title}</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([name, count]) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-700"
          >
            <span className="font-semibold text-zinc-900">{count}</span>
            <span className="text-zinc-500">{name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
