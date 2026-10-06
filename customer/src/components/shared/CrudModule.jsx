import { useState } from "react";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
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
import { KpiCard } from "@/components/shared/KpiCard";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";

function emptyFrom(fields) {
  const o = {};
  fields.forEach((f) => { o[f.key] = f.default ?? ""; });
  return o;
}

export default function CrudModule({ title, name, breadcrumb, columns, fields, detailFields, singular, kpiFn }) {
  const { rows, loading, create, update, remove } = useCrud(name);
  const kpiCards = kpiFn ? kpiFn(rows) : null;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [detail, setDetail] = useState(null);

  const openAdd = () => { setEditing(null); setForm(emptyFrom(fields)); setFormOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...row }); setFormOpen(true); };

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
        subtitle={`Manage ${title.toLowerCase()} — connected to the shared NTAXCO backend.`}
        actions={<Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={openAdd} data-testid="add-btn"><Plus className="h-4 w-4 mr-1.5" />Add {singular}</Button>}
      />
      {kpiCards && kpiCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpiCards.map((k, i) => <KpiCard key={i} {...k} loading={loading} testId={`kpi-${i}`} />)}
        </div>
      )}
      <DataTable title={title} columns={[...columns, actionCol]} rows={rows} loading={loading} pageSize={8} testId={`${name}-table`} />

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? `Edit ${singular}` : `Add ${singular}`}</DialogTitle>
            <DialogDescription>Fill in the details below. Data is saved to the NTAXCO backend and MongoDB.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {fields.map((f) => (
              <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                <Label className="text-sm font-medium text-zinc-700">{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
                {f.type === "select" ? (
                  <Select value={String(form[f.key] ?? "")} onValueChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}>
                    <SelectTrigger className="mt-1.5 border-zinc-300" data-testid={`field-${f.key}`}><SelectValue placeholder={`Select ${f.label}`} /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="mt-1.5 border-zinc-300 focus-visible:ring-brand/30"
                    data-testid={`field-${f.key}`}
                  />
                )}
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
        <SheetContent className="bg-white w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle className="font-heading">{singular} Details</SheetTitle></SheetHeader>
          {detail && (
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
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
