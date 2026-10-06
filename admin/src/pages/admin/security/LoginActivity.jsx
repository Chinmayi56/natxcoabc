import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Download, ChevronLeft, ChevronRight, Search } from "lucide-react";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "admin", label: "Super Admin" },
  { value: "employee", label: "Employee" },
  { value: "customer", label: "Customer" },
  { value: "agent", label: "Tax Consultant" },
];
const METHOD_OPTIONS = [
  { value: "all", label: "All Methods" },
  { value: "MOBILE_OTP", label: "Mobile OTP" },
  { value: "EMAIL_PASSWORD", label: "Email/Password" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
];
const DATE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function dateRangeFor(preset) {
  if (preset === "all") return {};
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  if (preset === "today") return { date_from: startOfDay(now) };
  if (preset === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const t = new Date(now);
    return { date_from: startOfDay(y), date_to: startOfDay(t) };
  }
  if (preset === "7d") { const d = new Date(now); d.setDate(d.getDate() - 7); return { date_from: d.toISOString() }; }
  if (preset === "30d") { const d = new Date(now); d.setDate(d.getDate() - 30); return { date_from: d.toISOString() }; }
  return {};
}

export default function LoginActivity() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1, total: 0, limit: 20 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("all");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, role, method, status, datePreset]);

  const params = useMemo(() => ({
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    role,
    method,
    status,
    ...dateRangeFor(datePreset),
  }), [page, debouncedSearch, role, method, status, datePreset]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get("/admin/security/login-activity", { params })
      .then((res) => {
        if (!active) return;
        setRows(res.data.data);
        setPagination(res.data.pagination);
      })
      .catch((e) => toast.error(describeApiError(e, "Failed to load login activity")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [params]);

  async function handleExport() {
    setExporting(true);
    try {
      const { page: _p, limit: _l, search: _s, ...filterParams } = params;
      const res = await api.get("/admin/security/login-activity/export", { params: filterParams, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "login-activity.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(describeApiError(e, "Failed to export login activity"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div data-testid="login-activity-page">
      <PageHeader
        title="Login Activity"
        subtitle="Every authentication event across all portals"
        breadcrumb={["Super Admin", "Security", "Login Activity"]}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} data-testid="export-login-activity">
            <Download className="w-4 h-4 mr-1.5" /> {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="login-activity-search"
            />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full md:w-40" data-testid="login-activity-role-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">{ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-full md:w-44" data-testid="login-activity-method-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">{METHOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-36" data-testid="login-activity-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-full md:w-40" data-testid="login-activity-date-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">{DATE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Login Time</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No login activity found for these filters.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} data-testid="login-activity-row">
                    <TableCell className="font-medium">{r.user_name}</TableCell>
                    <TableCell>{r.role_label}</TableCell>
                    <TableCell>{r.authentication_method === "MOBILE_OTP" ? "Mobile OTP" : "Email/Password"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.mobile_masked || "—"}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.ip_address}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{[r.browser, r.operating_system].filter(Boolean).join("/") || "—"}</TableCell>
                    <TableCell>
                      <Badge className={r.status === "SUCCESS" ? "border-transparent bg-emerald-100 text-emerald-700" : "border-transparent bg-red-100 text-red-700"}>
                        {r.status === "SUCCESS" ? "Success" : "Failed"}
                      </Badge>
                      {r.status === "FAILED" && r.failure_reason && (
                        <span className="block text-[11px] text-muted-foreground mt-0.5">{r.failure_reason}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!loading && pagination.total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Page {pagination.page || page} of {pagination.pages || 1} • {pagination.total} events</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="login-activity-prev">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= (pagination.pages || 1)} onClick={() => setPage((p) => p + 1)} data-testid="login-activity-next">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
