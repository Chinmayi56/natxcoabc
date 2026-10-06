import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Eye, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/components/shared/KpiCard";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import RelationshipPanel from "@/components/shared/RelationshipPanel";

function emptyFrom(fields) {
  const o = {};
  fields.forEach((f) => { o[f.key] = f.default ?? ""; });
  return o;
}

function RelationField({ field, value, onChange }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/${field.resource}`)
      .then(({ data }) => { if (active) setOptions(Array.isArray(data?.data) ? data.data : []); })
      .catch(() => { if (active) setOptions([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [field.resource]);

  const labelFor = (row) => {
    if (field.labelKey) return row[field.labelKey] || row.name || row.title || row.id;
    if (field.resource === "customers") return row.business_name || row.cust_id || row.id;
    if (field.resource === "services") return row.name || row.title || row.id;
    if (field.resource === "agents") return row.name || row.agent_id || row.id;
    if (field.resource === "invoices") return row.invoice_no || row.id;
    return row.name || row.title || row.id;
  };

  return (
    <Select value={String(value ?? "")} onValueChange={onChange}>
      <SelectTrigger className="mt-1.5 border-zinc-300" data-testid={`field-${field.key}`}>
        <SelectValue placeholder={loading ? "Loading…" : `Select ${field.label}`} />
      </SelectTrigger>
      <SelectContent className="bg-white max-h-64">
        {options.map((row) => <SelectItem key={row.id} value={row.id}>{labelFor(row)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function CrudModule({ title, name, breadcrumb, columns, fields, detailFields, singular, kpiFn, extra, subtitle, relationshipEntity, rowFilter, searchFields, renderDetail, customerService, rowActions }) {
  const { rows, loading, load, create, update, remove } = useCrud(name);
  const [serviceCustomers, setServiceCustomers] = useState([]);

  // Service modules use the canonical customer/service relationship from the
  // shared backend. This prevents unrelated customers from appearing here.
  useEffect(() => {
    if (!customerService) return undefined;
    let active = true;
    api.get("/customers")
      .then(({ data }) => {
        if (active) setServiceCustomers(Array.isArray(data?.data) ? data.data : []);
      })
      .catch(() => {
        if (active) setServiceCustomers([]);
        toast.error(`Unable to load ${customerService} customer relationships.`);
      });
    return () => { active = false; };
  }, [customerService]);

  const relatedCustomerIds = useMemo(() => {
    if (!customerService) return new Set();
    const target = String(customerService).trim().toLowerCase();
    return new Set(serviceCustomers.filter((c) => {
      const service = String(c.service_type || c.service || "").trim().toLowerCase();
      const category = String(c.service_category || "").trim().toLowerCase();
      return service === target || category === target || service.includes(target) || target.includes(service);
    }).map((c) => String(c.id)));
  }, [serviceCustomers, customerService]);

  const relatedCustomerNames = useMemo(() => {
    const set = new Set();
    serviceCustomers.forEach((c) => {
      if (!relatedCustomerIds.has(String(c.id))) return;
      [c.business_name, c.owner, c.cust_id, c.name].filter(Boolean)
        .forEach((v) => set.add(String(v).trim().toLowerCase()));
    });
    return set;
  }, [serviceCustomers, relatedCustomerIds]);

  const serviceFilteredRows = useMemo(() => {
    if (!customerService) return rows;
    return rows.filter((r) => {
      const directId = r.customer_id || r.customerId;
      if (directId && relatedCustomerIds.has(String(directId))) return true;
      const names = [r.client, r.customer, r.company, r.business_name, r.customer_name, r.owner]
        .filter(Boolean).map((v) => String(v).trim().toLowerCase());
      return names.some((name) => relatedCustomerNames.has(name));
    });
  }, [rows, customerService, relatedCustomerIds, relatedCustomerNames]);

  const kpiCards = kpiFn ? kpiFn(serviceFilteredRows) : null;
  const displayRows = rowFilter ? rowFilter(serviceFilteredRows) : serviceFilteredRows;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link from a notification: ?open=<record id> opens that exact record.
  useEffect(() => {
    const wanted = searchParams.get("open");
    if (!wanted || loading) return;
    const match = rows.find((r) => r.id === wanted);
    if (match) setDetail(match); else toast.error(`${singular || "Record"} ${wanted} could not be found.`);
    setSearchParams({}, { replace: true });
  }, [rows, loading, searchParams, setSearchParams, singular]);

  const openAdd = () => { setEditing(null); setForm(emptyFrom(fields)); setFormOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setFormOpen(true); };
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (refreshing) return; // guard against duplicate calls from repeated clicks
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const save = async () => {
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? "").trim()) { toast.error(`${f.label} is required`); return; }
    }
    setSaving(true);
    try {
      const payload = { ...form };
      fields.forEach((f) => { if (f.type === "number") payload[f.key] = Number(payload[f.key]) || 0; });
      if (editing) await update(editing.id, payload);
      else await create(payload);
      setFormOpen(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Save failed");
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    try { await remove(deleteId); } catch (e) { toast.error("Delete failed"); }
    setDeleteId(null);
  };

  const actionCol = {
    key: "actions", label: "Actions",
    render: (r) => (
      <div className="flex items-center gap-1">
        {rowActions && rowActions(r)}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(r)} data-testid={`view-${r.id}`}><Eye className="h-4 w-4 text-zinc-500" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} data-testid={`edit-${r.id}`}><Pencil className="h-4 w-4 text-zinc-500" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(r.id)} data-testid={`delete-${r.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      </div>
    ),
  };

  return (
    <div>
      <PageHeader
        title={title}
        breadcrumb={breadcrumb}
        subtitle={subtitle || `Manage ${title.toLowerCase()} — connected to the shared NTAXCO backend.`}
        actions={<>
          <Button variant="outline" className="border-zinc-300" onClick={refresh} disabled={refreshing || loading} data-testid="refresh-btn" title="Refresh">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${(refreshing || loading) ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={openAdd} data-testid="add-btn"><Plus className="h-4 w-4 mr-1.5" />Add {singular}</Button>
        </>}
      />
      {kpiCards && kpiCards.length > 0 && (
        <div className={`grid grid-cols-2 gap-4 mb-6 ${kpiCards.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          {kpiCards.map((k, i) => <KpiCard key={i} {...k} loading={loading} testId={`kpi-${i}`} />)}
        </div>
      )}
      {extra && <div className="mb-6">{extra(rows, loading, load)}</div>}
      <DataTable title={title} columns={[...columns, actionCol]} rows={displayRows} loading={loading} pageSize={8} testId={`${name}-table`} searchFields={searchFields} />

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? `Edit ${singular}` : `Add ${singular}`}</DialogTitle>
            <DialogDescription>Fill in the details below. Data is saved to the NTAXCO backend and MongoDB.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {fields.map((f, i) => (
              <div key={f.key} style={{ display: "contents" }}>
                {f.section && f.section !== fields[i - 1]?.section && (
                  <div className="sm:col-span-2 pt-2 first:pt-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-royal border-b border-zinc-200 pb-1.5">{f.section}</div>
                  </div>
                )}
                <div className={f.full ? "sm:col-span-2" : ""}>
                <Label className="text-sm font-medium text-zinc-700">{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
                {f.type === "relation" ? (
                  <RelationField field={f} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
                ) : f.type === "select" ? (
                  <Select value={String(form[f.key] ?? "")} onValueChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}>
                    <SelectTrigger className="mt-1.5 border-zinc-300" data-testid={`field-${f.key}`}><SelectValue placeholder={`Select ${f.label}`} /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : f.type === "textarea" ? (
                  <Textarea
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="mt-1.5 border-zinc-300 focus-visible:ring-brand/30"
                    rows={4}
                    data-testid={`field-${f.key}`}
                  />
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "password" ? "password" : "text"}
                    placeholder={f.type === "password" && editing ? "Leave blank to keep the current password" : undefined}
                    autoComplete={f.type === "password" ? "new-password" : undefined}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="mt-1.5 border-zinc-300 focus-visible:ring-brand/30"
                    data-testid={`field-${f.key}`}
                  />
                )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-300" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={save} disabled={saving} data-testid="save-btn">{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The record will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete} data-testid="confirm-delete">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail drawer */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className={`bg-white w-full overflow-y-auto ${renderDetail ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
          <SheetHeader><SheetTitle className="font-heading">{singular} Details</SheetTitle></SheetHeader>
          {detail && renderDetail ? (
            <div className="mt-6">{renderDetail(detail, { close: () => setDetail(null), openEdit: () => { setDetail(null); openEdit(detail); } })}</div>
          ) : detail && (
            <div className="mt-6 space-y-3">
              {(detailFields || fields.map((f) => f.key)).map((k) => {
                const fld = fields.find((f) => f.key === k);
                const label = fld ? fld.label : k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div key={k} className="flex justify-between gap-4 py-2 border-b border-zinc-100">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium text-zinc-800 text-right">{String(detail[k] ?? "—")}</span>
                  </div>
                );
              })}
              {relationshipEntity && <RelationshipPanel entity={relationshipEntity} recordId={detail.id} />}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
