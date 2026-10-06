// Display helpers for notifications (formatting only — all data comes from the API).
export const KIND_LABEL = {
  SERVICE_BOOKING: "New service booking",
  CUSTOMER_REGISTERED: "New customer registered",
  CUSTOMER_LOGIN: "Customer login",
  BOOKING_STATUS: "Booking status update",
  LEAVE_REQUEST: "New leave request",
  LEAVE_STATUS: "Leave request update",
  TASK: "Task update",
  TASK_OVERDUE: "Overdue task",
};

export function formatWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return `Today, ${time}`;
  if (same(d, yesterday)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${time}`;
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

// Where a notification leads. Admin gets exact-record deep links; other roles
// fall back to their own Notifications page (detail dialog).
export function notificationTarget(n, base = "/admin") {
  if (base !== "/admin" || !n) return null;
  if (n.task_id) return `${base}/task-board?task=${encodeURIComponent(n.task_id)}`;
  if (n.booking_id) return `${base}/bookings?open=${encodeURIComponent(n.booking_id)}`;
  if (n.leave_id) return `${base}/leave-requests?open=${encodeURIComponent(n.leave_id)}`;
  if (n.customer_id) return `${base}/customers?open=${encodeURIComponent(n.customer_id)}`;
  return null;
}
