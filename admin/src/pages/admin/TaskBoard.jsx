import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertCircle, CalendarDays, CheckCircle2, ChevronDown, Clock3, Filter,
  GripVertical, MessageSquare, Plus, RefreshCw, Search, Trash2, UserRound,
  X, ArrowRight, CircleDot, Pencil, Loader2
} from "lucide-react";
import api, { describeApiError } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const TASK_STATUSES = ["TO DO", "IN PROGRESS", "REVIEW", "COMPLETED"];
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const EMPTY_OPTIONS = {
  customers: [],
  services: [],
  employees: [],
  bookings: [],
};

const statusMeta = {
  "TO DO": {
    icon: CircleDot,
    tone: "text-zinc-600",
    header: "bg-zinc-100",
  },
  "IN PROGRESS": {
    icon: Clock3,
    tone: "text-blue-700",
    header: "bg-blue-50",
  },
  REVIEW: {
    icon: AlertCircle,
    tone: "text-amber-700",
    header: "bg-amber-50",
  },
  COMPLETED: {
    icon: CheckCircle2,
    tone: "text-emerald-700",
    header: "bg-emerald-50",
  },
};

function taskDue(task) {
  if (!task?.due_date) return null;

  const raw = String(task.due_date).slice(0, 10);
  const due = new Date(`${raw}T00:00:00`);

  if (Number.isNaN(due.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = Math.round((due - today) / 86400000);

  if (task.status !== "COMPLETED" && diff < 0) {
    return {
      label: "Overdue",
      cls: "text-red-600 bg-red-50",
    };
  }

  if (diff === 0) {
    return {
      label: "Due today",
      cls: "text-amber-700 bg-amber-50",
    };
  }

  if (diff === 1) {
    return {
      label: "Due tomorrow",
      cls: "text-amber-700 bg-amber-50",
    };
  }

  return {
    label: raw,
    cls: "text-zinc-600 bg-zinc-50",
  };
}

function priorityClass(priority) {
  return (
    {
      Urgent: "border-red-200 bg-red-50 text-red-700",
      High: "border-orange-200 bg-orange-50 text-orange-700",
      Medium: "border-amber-200 bg-amber-50 text-amber-700",
      Low: "border-zinc-200 bg-zinc-50 text-zinc-600",
    }[priority] || "border-zinc-200 bg-zinc-50 text-zinc-600"
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

function NativeSelect({ value, onChange, children, disabled = false }) {
  return (
    <select
      value={value ?? ""}
      onChange={onChange}
      disabled={disabled}
      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-amber-400 disabled:bg-zinc-50"
    >
      {children}
    </select>
  );
}

function TaskCreateDialog({
  open,
  onOpenChange,
  options,
  onCreated,
  initialBooking = null,
}) {
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    status: "TO DO",
    employee_id: "",
    customer_id: "",
    booking_id: "",
    service_id: "",
    due_date: "",
  });

  const [localOptions, setLocalOptions] = useState(
    options || EMPTY_OPTIONS
  );

  useEffect(() => {
    setLocalOptions(options || EMPTY_OPTIONS);
  }, [options]);

  useEffect(() => {
    if (!open || (options?.employees || []).length) return;

    api
      .get("/admin/tasks/options")
      .then(({ data }) => {
        if (data?.data) setLocalOptions(data.data);
      })
      .catch(() => {});
  }, [open, options]);

  useEffect(() => {
    if (!open) return;

    const b = initialBooking;

    setForm({
      title: b ? `Follow up: ${b.booking_no || b.id}` : "",
      description: "",
      priority:
        b?.priority && TASK_PRIORITIES.includes(b.priority)
          ? b.priority
          : "Medium",
      status: "TO DO",
      employee_id: "",
      customer_id: b?.customer_id || "",
      booking_id: b?.id || "",
      service_id: b?.service_id || "",
      due_date: b?.due_date || "",
    });
  }, [open, initialBooking]);

  const set = (key, value) =>
    setForm((f) => ({
      ...f,
      [key]: value,
    }));

  const bookings = localOptions.bookings || [];
  const customers = localOptions.customers || [];
  const services = localOptions.services || [];
  const employees = localOptions.employees || [];

  const submit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      return toast.error("Task title is required");
    }

    setSaving(true);

    try {
      const { data } = await api.post("/admin/tasks", form);

      toast.success("Task created");

      onCreated?.(data?.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(describeApiError(err, "Unable to create task"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Create a real NTAXCO task linked to existing ERP records.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Task title *" className="md:col-span-2">
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Prepare GST registration documents"
              />
            </Field>

            <Field label="Description" className="md:col-span-2">
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Add task details..."
                rows={4}
              />
            </Field>

            <Field label="Priority">
              <NativeSelect
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              >
                {TASK_PRIORITIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Status">
              <NativeSelect
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {TASK_STATUSES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Assigned employee">
              <NativeSelect
                value={form.employee_id}
                onChange={(e) => set("employee_id", e.target.value)}
              >
                <option value="">Unassigned</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name || e.emp_id || e.id}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Customer">
              <NativeSelect
                value={form.customer_id}
                onChange={(e) => set("customer_id", e.target.value)}
              >
                <option value="">No customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.business_name || c.owner || c.name || c.id}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Related booking">
              <NativeSelect
                value={form.booking_id}
                onChange={(e) => {
                  const b = bookings.find(
                    (x) => x.id === e.target.value
                  );

                  setForm((f) => ({
                    ...f,
                    booking_id: e.target.value,
                    customer_id: b?.customer_id || f.customer_id,
                    service_id: b?.service_id || f.service_id,
                  }));
                }}
              >
                <option value="">No booking</option>

                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.booking_no || b.id} · {b.customer || ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Related service">
              <NativeSelect
                value={form.service_id}
                onChange={(e) => set("service_id", e.target.value)}
              >
                <option value="">No service</option>

                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.title || s.category || s.id}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Due date">
              <Input
                type="date"
                value={form.due_date || ""}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailsDialog({
  task,
  open,
  onOpenChange,
  options,
  onChanged,
}) {
  const [detail, setDetail] = useState(task);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [commenting, setCommenting] = useState(false);

  useEffect(() => {
    setDetail(task);
    setComment("");
  }, [task]);

  useEffect(() => {
    if (!open || !task?.id) return;

    api
      .get(`/admin/tasks/${task.id}`)
      .then(({ data }) => setDetail(data?.data || task))
      .catch(() => {});
  }, [open, task]);

  if (!detail) return null;

  const employees = options.employees || [];
  const due = taskDue(detail);

  const update = async (patch) => {
    setSaving(true);

    try {
      const { data } = await api.put(
        `/admin/tasks/${detail.id}`,
        patch
      );

      setDetail(data?.data);
      onChanged?.();
      toast.success("Task updated");
    } catch (err) {
      toast.error(
        describeApiError(err, "Unable to update task")
      );
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;

    setCommenting(true);

    try {
      await api.post(`/admin/tasks/${detail.id}/comment`, {
        comment: comment.trim(),
      });

      const { data } = await api.get(
        `/admin/tasks/${detail.id}`
      );

      setDetail(data?.data || detail);
      setComment("");
      onChanged?.();

      toast.success("Comment added");
    } catch (err) {
      toast.error(
        describeApiError(err, "Unable to add comment")
      );
    } finally {
      setCommenting(false);
    }
  };

  const deleteTask = async () => {
    if (
      !window.confirm(
        "Delete this task and its activity history?"
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await api.delete(`/admin/tasks/${detail.id}`);

      toast.success("Task deleted");
      onOpenChange(false);
      onChanged?.();
    } catch (err) {
      toast.error(
        describeApiError(err, "Unable to delete task")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle>{detail.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {detail.id}
              </DialogDescription>
            </div>

            <Badge className={priorityClass(detail.priority)}>
              {detail.priority}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-5">
            <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Description
              </p>

              <p className="text-sm text-zinc-700 whitespace-pre-wrap">
                {detail.description || "No description added."}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-zinc-500">Customer</p>
                <p className="text-sm font-medium mt-1 truncate">
                  {detail.customer || "—"}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-zinc-500">Booking</p>
                <p className="text-sm font-medium mt-1 truncate">
                  {detail.booking_no || "—"}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-zinc-500">Service</p>
                <p className="text-sm font-medium mt-1 truncate">
                  {detail.service || "—"}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-zinc-500">Due</p>
                <p
                  className={`text-sm font-medium mt-1 truncate ${
                    due?.label === "Overdue"
                      ? "text-red-600"
                      : ""
                  }`}
                >
                  {due?.label || "—"}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">
                Activity & history
              </h3>

              <div className="space-y-3 border-l-2 border-zinc-200 pl-4">
                {(detail.activity || []).length ? (
                  detail.activity.map((a) => (
                    <div key={a.id} className="relative">
                      <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-amber-400 border-2 border-white" />

                      <p className="text-sm font-medium text-zinc-800">
                        {a.action}
                      </p>

                      {a.details?.comment && (
                        <p className="text-sm text-zinc-600 mt-1">
                          {a.details.comment}
                        </p>
                      )}

                      <p className="text-xs text-zinc-400 mt-1">
                        {a.user_name || "Admin"} ·{" "}
                        {a.created_at
                          ? new Date(
                              a.created_at
                            ).toLocaleString()
                          : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">
                    No activity yet.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment or note..."
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    addComment();
                  }
                }}
              />

              <Button
                onClick={addComment}
                disabled={
                  commenting || !comment.trim()
                }
              >
                {commenting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                )}
                Comment
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Status">
              <NativeSelect
                value={detail.status}
                onChange={(e) =>
                  update({ status: e.target.value })
                }
                disabled={saving}
              >
                {TASK_STATUSES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Priority">
              <NativeSelect
                value={detail.priority}
                onChange={(e) =>
                  update({ priority: e.target.value })
                }
                disabled={saving}
              >
                {TASK_PRIORITIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Assigned employee">
              <NativeSelect
                value={detail.employee_id || ""}
                onChange={(e) =>
                  update({
                    employee_id:
                      e.target.value || null,
                  })
                }
                disabled={saving}
              >
                <option value="">Unassigned</option>

                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name || e.emp_id || e.id}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Due date">
              <Input
                type="date"
                value={detail.due_date || ""}
                disabled={saving}
                onChange={(e) =>
                  update({
                    due_date:
                      e.target.value || null,
                  })
                }
              />
            </Field>

            <div className="text-xs text-zinc-500 space-y-1 pt-2">
              <p>
                Created:{" "}
                {detail.created_at
                  ? new Date(
                      detail.created_at
                    ).toLocaleString()
                  : "—"}
              </p>

              <p>
                Updated:{" "}
                {detail.updated_at
                  ? new Date(
                      detail.updated_at
                    ).toLocaleString()
                  : "—"}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={deleteTask}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskBoard({
  initialBooking = null,
  openCreate = false,
  onCloseCreate,
}) {
  const location = useLocation();

  const [tasks, setTasks] = useState([]);
  const [options, setOptions] = useState({
    customers: [],
    services: [],
    employees: [],
    bookings: [],
  });

  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [createOpen, setCreateOpen] =
    useState(openCreate);
  const [selected, setSelected] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    priority: "all",
    employee_id: "all",
    customer_id: "all",
    service_id: "all",
    due: "all",
  });

  useEffect(() => {
    setCreateOpen(openCreate);
  }, [openCreate]);

  useEffect(() => {
    if (!createOpen) onCloseCreate?.();
  }, [createOpen, onCloseCreate]);

  const loadOptions = async () => {
    try {
      const { data } = await api.get(
        "/admin/tasks/options"
      );

      setOptions(data?.data || {});
    } catch (err) {
      toast.error(
        describeApiError(
          err,
          "Unable to load task options"
        )
      );
    }
  };

  /*
   * FIX:
   * useCallback keeps loadTasks stable between renders
   * until the filters actually change.
   */
  const loadTasks = useCallback(async () => {
    setLoading(true);

    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(
          ([, v]) => v && v !== "all"
        )
      );

      const { data } = await api.get(
        "/admin/tasks",
        { params }
      );

      setTasks(data?.data || []);
    } catch (err) {
      toast.error(
        describeApiError(
          err,
          "Unable to load Task Board"
        )
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadOptions();
  }, []);

  /*
   * FIX:
   * loadTasks is now a proper dependency.
   */
  useEffect(() => {
    const timer = setTimeout(
      loadTasks,
      filters.search ? 250 : 0
    );

    return () => clearTimeout(timer);
  }, [loadTasks, filters.search]);

  /*
   * FIX:
   * loadTasks is now a proper dependency.
   */
  useEffect(() => {
    const refresh = () => loadTasks();

    window.addEventListener(
      "ntaxco:data-changed",
      refresh
    );

    return () =>
      window.removeEventListener(
        "ntaxco:data-changed",
        refresh
      );
  }, [loadTasks]);

  useEffect(() => {
    const taskId = new URLSearchParams(
      location.search
    ).get("task");

    if (taskId && tasks.length) {
      const found = tasks.find(
        (t) => t.id === taskId
      );

      if (found) setSelected(found);
    }
  }, [location.search, tasks]);

  const columns = useMemo(
    () =>
      TASK_STATUSES.map((status) => ({
        status,
        tasks: tasks.filter(
          (t) => t.status === status
        ),
      })),
    [tasks]
  );

  const changeStatus = async (task, status) => {
    if (!task || task.status === status) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status }
          : t
      )
    );

    try {
      const { data } = await api.put(
        `/admin/tasks/${task.id}`,
        { status }
      );

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? data?.data || {
                ...t,
                status,
              }
            : t
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "ntaxco:data-changed",
          {
            detail: {
              resources: ["tasks"],
            },
          }
        )
      );
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? task : t
        )
      );

      toast.error(
        describeApiError(
          err,
          "Unable to change task status"
        )
      );
    } finally {
      setDragging(null);
    }
  };

  const resetFilters = () =>
    setFilters({
      search: "",
      status: "all",
      priority: "all",
      employee_id: "all",
      customer_id: "all",
      service_id: "all",
      due: "all",
    });

  const employeeName = (id) =>
    options.employees.find(
      (e) => e.id === id
    )?.name || id;

  return (
    <div>
      <PageHeader
        title="Task Board"
        subtitle="Internal NTAXCO task management — linked to live customers, bookings, services and employees."
        breadcrumb={[
          "Super Admin",
          "Task Board",
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadTasks}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </Button>

            <Button
              onClick={() =>
                setCreateOpen(true)
              }
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Task
            </Button>
          </div>
        }
      />

      <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />

            <Input
              className="pl-9"
              placeholder="Search title, customer, booking, service..."
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  search: e.target.value,
                }))
              }
            />
          </div>

          <NativeSelect
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: e.target.value,
              }))
            }
          >
            <option value="all">
              All statuses
            </option>

            {TASK_STATUSES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={filters.priority}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                priority: e.target.value,
              }))
            }
          >
            <option value="all">
              All priorities
            </option>

            {TASK_PRIORITIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={filters.employee_id}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                employee_id:
                  e.target.value,
              }))
            }
          >
            <option value="all">
              All employees
            </option>

            {options.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name || e.emp_id}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={filters.customer_id}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                customer_id:
                  e.target.value,
              }))
            }
          >
            <option value="all">
              All customers
            </option>

            {options.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name ||
                  c.owner ||
                  c.name}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={filters.service_id}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                service_id:
                  e.target.value,
              }))
            }
          >
            <option value="all">
              All services
            </option>

            {options.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ||
                  s.title ||
                  s.category}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Filter className="h-4 w-4 text-zinc-400" />

          <NativeSelect
            value={filters.due}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                due: e.target.value,
              }))
            }
          >
            <option value="all">
              All due dates
            </option>
            <option value="overdue">
              Overdue
            </option>
            <option value="today">
              Due today
            </option>
            <option value="tomorrow">
              Due tomorrow
            </option>
            <option value="upcoming">
              Upcoming
            </option>
          </NativeSelect>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
          >
            Clear filters
          </Button>

          <span className="ml-auto text-xs text-zinc-500">
            {tasks.length} task
            {tasks.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="grid grid-cols-4 gap-4 min-w-[1080px] items-start">
          {columns.map(
            ({ status, tasks: columnTasks }) => {
              const meta =
                statusMeta[status];

              const Icon = meta.icon;

              return (
                <section
                  key={status}
                  className={`rounded-xl border border-zinc-200 bg-zinc-50/80 min-h-[520px] ${
                    dragging?.status === status
                      ? "ring-2 ring-amber-300"
                      : ""
                  }`}
                  onDragOver={(e) =>
                    e.preventDefault()
                  }
                  onDrop={() =>
                    dragging &&
                    changeStatus(
                      dragging,
                      status
                    )
                  }
                >
                  <div
                    className={`rounded-t-xl px-3 py-3 flex items-center justify-between ${meta.header}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-4 w-4 ${meta.tone}`}
                      />

                      <h2 className="text-sm font-semibold text-zinc-800">
                        {status}
                      </h2>
                    </div>

                    <span className="text-xs font-semibold rounded-full bg-white/80 px-2 py-0.5 text-zinc-500">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="p-2 space-y-2 min-h-[470px]">
                    {loading ? (
                      <div className="py-10 text-center text-sm text-zinc-400">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Loading tasks...
                      </div>
                    ) : (
                      columnTasks.map(
                        (task) => {
                          const due =
                            taskDue(task);

                          return (
                            <article
                              key={task.id}
                              draggable
                              onDragStart={() =>
                                setDragging(
                                  task
                                )
                              }
                              onDragEnd={() =>
                                setDragging(
                                  null
                                )
                              }
                              onClick={() =>
                                setSelected(
                                  task
                                )
                              }
                              className={`bg-white rounded-lg border border-zinc-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                                dragging?.id ===
                                task.id
                                  ? "opacity-50"
                                  : ""
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-4 w-4 text-zinc-300 shrink-0 mt-0.5" />

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-medium text-sm text-zinc-900 leading-5">
                                      {task.title}
                                    </h3>

                                    <Badge
                                      className={`shrink-0 text-[10px] ${priorityClass(
                                        task.priority
                                      )}`}
                                    >
                                      {task.priority}
                                    </Badge>
                                  </div>

                                  {task.description && (
                                    <p className="text-xs text-zinc-500 line-clamp-2 mt-1.5">
                                      {
                                        task.description
                                      }
                                    </p>
                                  )}

                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {task.customer && (
                                      <span className="text-[11px] rounded bg-zinc-50 px-1.5 py-1 text-zinc-600">
                                        {
                                          task.customer
                                        }
                                      </span>
                                    )}

                                    {task.service && (
                                      <span className="text-[11px] rounded bg-zinc-50 px-1.5 py-1 text-zinc-600">
                                        {
                                          task.service
                                        }
                                      </span>
                                    )}

                                    {task.booking_no && (
                                      <span className="text-[11px] rounded bg-zinc-50 px-1.5 py-1 text-zinc-600">
                                        {
                                          task.booking_no
                                        }
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-zinc-100">
                                    <span className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                                      <UserRound className="h-3.5 w-3.5" />
                                      {task.assigned_employee ||
                                        "Unassigned"}
                                    </span>

                                    {due && (
                                      <span
                                        className={`text-[10px] font-medium px-1.5 py-1 rounded ${due.cls}`}
                                      >
                                        {due.label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        }
                      )
                    )}

                    {!loading &&
                      !columnTasks.length && (
                        <div className="text-center py-12 text-xs text-zinc-400">
                          Drop tasks here
                        </div>
                      )}
                  </div>
                </section>
              );
            }
          )}
        </div>
      </div>

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        options={options}
        initialBooking={initialBooking}
        onCreated={() => {
          loadTasks();

          window.dispatchEvent(
            new CustomEvent(
              "ntaxco:data-changed",
              {
                detail: {
                  resources: ["tasks"],
                },
              }
            )
          );
        }}
      />

      <TaskDetailsDialog
        task={selected}
        open={!!selected}
        onOpenChange={(o) =>
          !o && setSelected(null)
        }
        options={options}
        onChanged={() => {
          loadTasks();

          window.dispatchEvent(
            new CustomEvent(
              "ntaxco:data-changed",
              {
                detail: {
                  resources: ["tasks"],
                },
              }
            )
          );
        }}
      />
    </div>
  );
}

export { TaskCreateDialog };