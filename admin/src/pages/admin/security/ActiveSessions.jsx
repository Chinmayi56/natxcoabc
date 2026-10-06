import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Monitor, Smartphone, LogOut } from "lucide-react";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return `${Math.round(hrs / 24)} day(s) ago`;
}

export default function ActiveSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/security/sessions");
      setSessions(res.data.data.sessions);
    } catch (e) {
      toast.error(describeApiError(e, "Failed to load active sessions"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmTerminate() {
    if (!terminating) return;
    setBusy(true);
    try {
      await api.post(`/admin/security/sessions/${terminating}/terminate`);
      toast.success("Session terminated successfully.");
      setTerminating(null);
      await load();
    } catch (e) {
      toast.error(describeApiError(e, "Failed to terminate session"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="active-sessions-page">
      <PageHeader
        title="Active Sessions"
        subtitle="Devices currently signed in across every portal"
        breadcrumb={["Super Admin", "Security", "Active Sessions"]}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No active sessions right now.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => {
            const DeviceIcon = s.device === "Mobile" ? Smartphone : Monitor;
            return (
              <Card key={s.session_id} data-testid="active-session-card">
                <CardContent className="p-5 flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                      <DeviceIcon className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-zinc-900 truncate">{s.user_name}</p>
                        {s.is_current && <Badge className="border-transparent bg-amber-100 text-amber-700">Current Session</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.role_label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.browser || "Unknown"} • {s.device || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Active {timeAgo(s.last_activity)}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 shrink-0"
                    onClick={() => setTerminating(s.session_id)}
                    data-testid={`terminate-session-${s.session_id}`}
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" /> Terminate
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!terminating} onOpenChange={(open) => !open && setTerminating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate this session?</AlertDialogTitle>
            <AlertDialogDescription>The user will be signed out from this device.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTerminate} disabled={busy} className="bg-red-600 hover:bg-red-700">
              {busy ? "Terminating…" : "Terminate Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
