import { useEffect, useMemo, useState } from "react";
import {
  Clock, CheckCircle2, ClipboardList, Building2, FolderKanban,
  PlaneTakeoff, Bell, TrendingUp, LogIn,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartCard, BarChartView, DonutChartView } from "@/components/shared/Charts";
import { ActivityFeed, DueDatesWidget } from "@/components/shared/Widgets";
import { useAuth } from "@/context/AuthContext";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";

const B = "/employee";

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [notifications, setNotifications] = useState({ notifications: [], unread: 0 });
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [profileRes, attRes, taskRes, leaveRes, notifRes] = await Promise.allSettled([
          api.get("/employees/me"),
          api.get("/attendance"),
          api.get("/tasks"),
          api.get("/leaves"),
          api.get("/notifications"),
        ]);
        if (!active) return;
        if (profileRes.status === "fulfilled") {
          setProfile(profileRes.value.data?.data || null);
          setProfileError(null);
        } else {
          setProfile(null);
          setProfileError(describeApiError(profileRes.reason, "Unable to load your employee profile."));
        }
        if (attRes.status === "fulfilled") setAttendance(attRes.value.data?.data || []);
        if (taskRes.status === "fulfilled") setTasks(taskRes.value.data?.data || []);
        if (leaveRes.status === "fulfilled") setLeaves(leaveRes.value.data?.data || []);
        if (notifRes.status === "fulfilled") setNotifications(notifRes.value.data?.data || { notifications: [], unread: 0 });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (profileError) toast.error(profileError);
  }, [profileError]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.find((a) => a.date === todayIso);
  const pendingTasks = tasks.filter((t) => t.status !== "Completed").length;
  const completedTasks = tasks.filter((t) => t.status === "Completed").length;
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;

  const cards = [
    { title: "Today's Attendance", value: todayAttendance ? todayAttendance.status : "Not marked", icon: LogIn, to: `${B}/attendance` },
    { title: "Working Hours Today", value: todayAttendance?.hours && todayAttendance.hours !== "-" ? todayAttendance.hours : "—", icon: Clock, to: `${B}/attendance` },
    { title: "Monthly Attendance", value: profile?.attendance_pct != null ? `${profile.attendance_pct}%` : "—", icon: TrendingUp, to: `${B}/attendance` },
    { title: "Pending Tasks", value: pendingTasks, icon: ClipboardList, to: `${B}/tasks` },
    { title: "Completed Tasks", value: completedTasks, icon: CheckCircle2, to: `${B}/tasks` },
    { title: "Assigned Customers", value: profile?.assigned_clients ?? "—", icon: Building2, to: `${B}/customers` },
    { title: "Assigned Projects", value: profile?.assigned_projects ?? "—", icon: FolderKanban, to: `${B}/projects` },
    { title: "Pending Leave Requests", value: pendingLeaves, icon: PlaneTakeoff, to: `${B}/leave` },
    { title: "Performance Score", value: profile?.performance != null ? `${profile.performance} / 100` : "—", icon: TrendingUp, to: `${B}/performance` },
    { title: "Notifications", value: notifications.unread ?? 0, icon: Bell, to: `${B}/notifications` },
  ];

  const attendanceBreakdown = useMemo(() => {
    const counts = {};
    attendance.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [attendance]);

  const taskStatusChart = useMemo(() => {
    const order = ["Pending", "Running", "Completed"];
    const counts = { Pending: 0, Running: 0, Completed: 0 };
    tasks.forEach((t) => { if (counts[t.status] != null) counts[t.status] += 1; });
    return order.map((status) => ({ status, count: counts[status] }));
  }, [tasks]);

  const activityItems = useMemo(() => (
    (notifications.notifications || []).slice(0, 6).map((n) => ({
      title: n.title, time: timeAgo(n.ts), tag: n.category || "Update",
    }))
  ), [notifications]);

  const dueDateItems = useMemo(() => (
    tasks
      .filter((t) => t.status !== "Completed" && t.due_date)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
      .slice(0, 6)
      .map((t) => ({ title: t.title, date: t.due_date, type: t.priority || "Task" }))
  ), [tasks]);

  return (
    <div>
      <PageHeader
        title="Employee Dashboard"
        subtitle={`Welcome back, ${user?.name || "there"}${profile?.designation ? ` — ${profile.designation}` : ""}.`}
        breadcrumb={["Employee", "Dashboard"]}
      />
      {!loading && profileError && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {profileError} Your account isn't linked to an employee record yet, so attendance, tasks, and payroll can't load. Please contact your admin to link this login to your employee profile.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c, i) => <KpiCard key={i} {...c} loading={loading} testId={`kpi-${i}`} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Attendance Breakdown" testId="chart-attendance">
          {attendanceBreakdown.length > 0 ? <DonutChartView data={attendanceBreakdown} /> : <p className="text-sm text-muted-foreground">No attendance records yet.</p>}
        </ChartCard>
        <ChartCard title="Task Status" testId="chart-tasks">
          {tasks.length > 0 ? <BarChartView data={taskStatusChart} xKey="status" keys={[{ key: "count", name: "Tasks" }]} /> : <p className="text-sm text-muted-foreground">No tasks yet.</p>}
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ActivityFeed items={activityItems} />
        <DueDatesWidget items={dueDateItems} />
      </div>
    </div>
  );
}
