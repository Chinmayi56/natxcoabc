import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LogIn, MessageSquareText, ShieldAlert, Activity, UserX } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";

const STAT_CARDS = [
  { key: "today_logins", label: "Today's Logins", icon: LogIn, tone: "text-emerald-600 bg-emerald-50" },
  { key: "otp_requests", label: "OTP Requests", icon: MessageSquareText, tone: "text-blue-600 bg-blue-50" },
  { key: "failed_login_attempts", label: "Failed Login Attempts", icon: ShieldAlert, tone: "text-red-600 bg-red-50" },
  { key: "active_sessions", label: "Active Sessions", icon: Activity, tone: "text-amber-600 bg-amber-50" },
  { key: "blocked_accounts", label: "Blocked Accounts", icon: UserX, tone: "text-zinc-600 bg-zinc-100" },
];

function statusTone(status) {
  return status === "SUCCESS"
    ? "border-transparent bg-emerald-100 text-emerald-700"
    : "border-transparent bg-red-100 text-red-700";
}

export default function SecurityOverview() {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ov, tr, rc] = await Promise.all([
          api.get("/admin/security/overview"),
          api.get("/admin/security/login-trend"),
          api.get("/admin/security/recent-activity", { params: { limit: 8 } }),
        ]);
        if (!active) return;
        setStats(ov.data.data);
        setTrend(tr.data.data);
        setRecent(rc.data.data);
      } catch (e) {
        toast.error(describeApiError(e, "Failed to load security overview"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div data-testid="security-overview-page">
      <PageHeader
        title="Security Overview"
        subtitle="Monitor authentication, sessions and security events across every portal"
        breadcrumb={["Super Admin", "Security", "Overview"]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {STAT_CARDS.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key} data-testid={`security-stat-${key}`}>
            <CardContent className="p-5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tone}`}>
                <Icon className="w-4.5 h-4.5" size={18} />
              </div>
              {loading ? (
                <Skeleton className="h-7 w-14 mb-1" />
              ) : (
                <p className="text-2xl font-bold text-zinc-900 leading-none">{stats?.[key] ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Login Activity Trend</CardTitle>
            <p className="text-xs text-muted-foreground">Successful logins over the last 7 days</p>
          </CardHeader>
          <CardContent className="pl-0">
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip cursor={{ fill: "#fafafa" }} />
                  <Bar dataKey="logins" fill="#FFB800" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Login Activity</CardTitle>
              <p className="text-xs text-muted-foreground">Latest authentication events</p>
            </div>
            <Link to="/admin/security/login-activity" className="text-xs font-medium text-zinc-900 hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No login activity yet.</p>
            ) : (
              <div className="divide-y">
                {recent.map((row) => (
                  <div key={row.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 truncate">{row.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.role_label} • {row.authentication_method === "MOBILE_OTP" ? "Mobile OTP" : "Email/Password"}
                        {row.device ? ` • ${row.browser}/${row.device === "Mobile" ? row.operating_system : row.operating_system}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      <Badge className={statusTone(row.status)}>{row.status === "SUCCESS" ? "Success" : "Failed"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
