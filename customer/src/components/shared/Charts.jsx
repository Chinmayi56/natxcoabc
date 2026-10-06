import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const PALETTE = ["#FFB800", "#18181B", "#71717A", "#FCD34D", "#D97706", "#A1A1AA"];

const gridProps = { strokeDasharray: "3 3", stroke: "#E4E4E7" };
const axisProps = { tick: { fontSize: 12, fill: "#71717A" }, axisLine: false, tickLine: false };
const tooltipStyle = {
  contentStyle: { background: "#fff", border: "1px solid #E4E4E7", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", fontSize: 13 },
};

export function ChartCard({ title, subtitle, children, actions, testId }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid={testId}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-heading text-base font-semibold text-zinc-900">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

export function AreaChartView({ data, xKey, keys }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={k.key} id={`g-${k.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.35} />
              <stop offset="95%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} />
        {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k, i) => (
          <Area key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} fill={`url(#g-${k.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarChartView({ data, xKey, keys }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "#FAFAFA" }} />
        {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k, i) => (
          <Bar key={k.key} dataKey={k.key} name={k.name} fill={PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} maxBarSize={40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartView({ data, xKey, keys }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <LineChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} />
        {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k, i) => (
          <Line key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChartView({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
