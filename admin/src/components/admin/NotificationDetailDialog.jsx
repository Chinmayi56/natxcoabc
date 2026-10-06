import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { describeApiError } from "@/lib/api";
import { inr } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KIND_LABEL, formatDate, formatTime, formatWhen } from "@/lib/notificationFormat";

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-2">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{children}</div>
    </div>
  );
}
function Field({ label, value }) {
  return (
    <div className="py-2 border-b border-zinc-100 last:border-b-0">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="text-sm font-medium text-zinc-800 break-words">{value || value === 0 ? value : "—"}</div>
    </div>
  );
}

// Loads the notification together with the customer / booking / service it
// points to (resolved live from MongoDB by GET /api/notifications/{id}).
export default function NotificationDetailDialog({ notificationId, onClose, base = "/admin" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!notificationId) return undefined;
    let cancelled = false;
    setData(null); setError("");
    api.get(`/notifications/${encodeURIComponent(notificationId)}`)
      .then(({ data: res }) => { if (!cancelled) setData(res.data); })
      .catch((e) => { if (!cancelled) setError(describeApiError(e, "Unable to load notification details")); });
    return () => { cancelled = true; };
  }, [notificationId]);

  const n = data?.notification; const c = data?.customer; const b = data?.booking; const lv = data?.leave; const s = data?.service; const task = data?.task;
  const history = data?.bookings || [];
  const amount = b ? (b.estimated_fee ?? b.project_value ?? s?.final_price) : null;

  return (
    <Dialog open={!!notificationId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="notification-detail">
        <DialogHeader>
          <DialogTitle className="font-heading">{n ? (KIND_LABEL[n.kind] || n.title) : "Notification"}</DialogTitle>
          <DialogDescription>{n ? `${n.description} · ${formatWhen(n.created_at || n.ts)}` : "Loading details…"}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="text-sm text-zinc-500 py-6 text-center">Loading…</p>}

        {data && (
          <div className="space-y-4">
            {data.missing?.length > 0 && (
              <p className="text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-800 p-2">
                The linked {data.missing.join(" / ")} record no longer exists in the database.
              </p>
            )}

            {c && (
              <Section title="Customer Information">
                <Field label="Customer name" value={c.business_name || c.owner} />
                <Field label="Customer ID" value={c.cust_id || c.id} />
                <Field label="Mobile" value={c.mobile} />
                <Field label="Email" value={c.email} />
                <Field label="Address" value={[c.address, c.city, c.state, c.pincode].filter(Boolean).join(", ")} />
                <Field label="Registration date" value={c.registration_date || (n?.kind === "CUSTOMER_REGISTERED" ? formatDate(n.created_at) : "")} />
                <Field label="Account status" value={c.status ? <StatusBadge value={c.status} /> : ""} />
              </Section>
            )}

            {b && (
              <Section title="Booking Information">
                <Field label="Booking ID" value={b.id} />
                <Field label="Service booked" value={b.service || s?.name} />
                <Field label="Booking date" value={formatDate(b.created_at || b.booking_date)} />
                <Field label="Booking time" value={formatTime(b.created_at)} />
                <Field label="Booking status" value={b.status ? <StatusBadge value={b.status} /> : ""} />
                <Field label="Payment status" value={b.payment_status} />
                <Field label="Preferred contact" value={[b.contact_person, b.mobile, b.email].filter(Boolean).join(" · ")} />
                <Field label="Preferred appointment" value={[b.appointment_date, b.appointment_time].filter(Boolean).join(" ")} />
                <Field label="Notes / message" value={b.notes || b.description} />
                <Field label="Amount / fee" value={amount != null && amount !== "" ? inr(amount) : ""} />
              </Section>
            )}

            {lv && (
              <Section title="Leave Request">
                <Field label="Leave ID" value={lv.id} />
                <Field label="Employee" value={lv.employee_name} />
                <Field label="Type" value={lv.leave_type} />
                <Field label="From" value={lv.from_date} />
                <Field label="To" value={lv.to_date} />
                <Field label="Status" value={lv.status ? <StatusBadge value={lv.status} /> : ""} />
                <Field label="Reason" value={lv.reason} />
              </Section>
            )}

            {task && (
              <Section title="Task Information">
                <Field label="Task ID" value={task.id} />
                <Field label="Title" value={task.title} />
                <Field label="Status" value={task.status} />
                <Field label="Priority" value={task.priority} />
                <Field label="Due date" value={task.due_date} />
                <Field label="Assigned employee" value={task.assigned_employee || task.employee_id} />
                <Field label="Description" value={task.description} />
              </Section>
            )}

            {s && (
              <Section title="Service Information">
                <Field label="Service name" value={s.name || s.title} />
                <Field label="Category" value={s.category} />
                <Field label="Description" value={s.description} />
                <Field label="Price / fee" value={s.final_price != null && s.final_price !== "" ? inr(s.final_price) : ""} />
              </Section>
            )}

            {n?.kind === "CUSTOMER_REGISTERED" && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-2">Services Booked / Booking History</div>
                {history.length === 0 ? <p className="text-sm text-zinc-500">No bookings yet.</p> : history.map((x) => (
                  <div key={x.id} className="flex items-center justify-between text-sm py-1.5 border-b border-zinc-100 last:border-b-0">
                    <span className="font-medium">{x.id} · {x.service}</span>
                    <span className="flex items-center gap-3 text-xs text-zinc-500">{formatDate(x.created_at)} <StatusBadge value={x.status} /></span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {b && <Button variant="outline" className="border-zinc-300" data-testid="notif-open-booking" onClick={() => { onClose(); navigate(`${base}/bookings?open=${encodeURIComponent(b.id)}`); }}>Open booking</Button>}
              {lv && <Button variant="outline" className="border-zinc-300" data-testid="notif-open-leave" onClick={() => { onClose(); navigate(`${base}/leave-requests?open=${encodeURIComponent(lv.id)}`); }}>Open leave request</Button>}
              {c && <Button variant="outline" className="border-zinc-300" data-testid="notif-open-customer" onClick={() => { onClose(); navigate(`${base}/customers?open=${encodeURIComponent(c.id)}`); }}>Open in Customers</Button>}
              {task && <Button variant="outline" className="border-zinc-300" data-testid="notif-open-task" onClick={() => { onClose(); navigate(`${base}/task-board?task=${encodeURIComponent(task.id)}`); }}>Open Task</Button>}
              <Button className="bg-royal text-white hover:bg-royal-hover" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
