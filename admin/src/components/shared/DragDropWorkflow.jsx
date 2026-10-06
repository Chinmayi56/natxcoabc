import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Check, GripVertical, Loader2, MoveRight, RefreshCw, Search, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import api, { describeApiError } from "@/lib/api";
import { notifyDataChanged } from "@/lib/dataSync";

/**
 * Accessible, dependency-free drag/drop workflow board.
 * Desktop: native HTML drag/drop.
 * Touch/keyboard: select a source and activate a target with Enter/Space/click.
 * The backend is always authoritative; no optimistic mutation is performed.
 */
export default function DragDropWorkflow({ title, description, sourceRows = [], sourceType, targetType, targets: staticTargets, targetEndpoint = "/services", sourceLabel, getSourceLabel, getSourceValue, getTargetLabel, getTargetValue, allowedStatuses = [], allowedServiceCategories = [], onRefresh }) {
  const [targets, setTargets] = useState(staticTargets || []);
  const [selectedSource, setSelectedSource] = useState(null);
  const [busyKey, setBusyKey] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    if (staticTargets) { setTargets(staticTargets); return undefined; }
    api.get(targetEndpoint).then(({ data }) => {
      if (!active) return;
      setTargets(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    }).catch(() => { if (active) setTargets([]); });
    return () => { active = false; };
  }, [staticTargets, targetEndpoint]);

  const visibleSources = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sourceRows;
    return sourceRows.filter((row) => `${getSourceLabel(row)} ${row.id || ""}`.toLowerCase().includes(q));
  }, [sourceRows, query, getSourceLabel]);

  const normalizedTargets = useMemo(() => targets.filter((target) => {
    if (targetType !== "service" || !allowedServiceCategories.length) return true;
    const category = String(target.category || "").trim();
    const name = String(target.name || target.title || "").trim();
    return allowedServiceCategories.includes(category) || allowedServiceCategories.includes(name);
  }).map((target) => ({
    raw: target,
    label: getTargetLabel ? getTargetLabel(target) : String(target),
    value: getTargetValue ? getTargetValue(target) : target,
  })), [targets, targetType, allowedServiceCategories, getTargetLabel, getTargetValue]);

  const isValidTarget = (source, target) => {
    if (!source || !target) return false;
    if (targetType === "service") {
      const category = String(target.category || target.title || target.name || target).trim();
      if (allowedServiceCategories.length && !allowedServiceCategories.includes(category)) return false;
      if (sourceType === "payment" && (source.invoice_id || source.invoice_no)) return false;
    }
    if (targetType === "payment-status" || targetType === "payment-frequency" || targetType === "status") {
      return !allowedStatuses.length || allowedStatuses.includes(String(target));
    }
    return true;
  };

  const applyDrop = async (source, target) => {
    const targetValue = getTargetValue ? getTargetValue(target) : target;
    const key = `${source?.id}:${targetValue}`;
    if (!source || !target) return;
    if (!isValidTarget(source, target)) {
      toast.error(sourceType === "payment" && targetType === "service" ? "Payments linked to an invoice inherit its service and cannot be reassigned here." : "That relationship is not valid.");
      return;
    }

    const currentValue = targetType === "service"
      ? (source.service_id || source.service_id)
      : targetType === "payment-frequency"
        ? source.payment_frequency
        : targetType === "payment-status"
          ? (source.filing_status || source.status)
          : source.status;
    const comparableTarget = targetType === "service"
      ? (target.id || target.value || target.name || target.title || target.category)
      : String(targetValue);
    if (String(currentValue || "") === String(comparableTarget || "")) {
      toast.info("No change needed — this record is already assigned to that value.");
      return;
    }

    setBusyKey(key);
    try {
      const payload = { source_type: sourceType, target_type: targetType, source_id: source.id, target_value: targetValue };
      const { data } = await api.post("/admin/workflows/drag-drop", payload);
      if (data?.data) await onRefresh?.();
      const affected = sourceType === "payment"
        ? ["payments", "invoices", "bookings", "customers"]
        : sourceType === "customer"
          ? ["customers", "bookings", "invoices", "payments"]
          : sourceType === "booking"
            ? ["bookings", "customers", "agents", "invoices"]
            : [sourceType];
      notifyDataChanged(affected);
      toast.success(data?.message || "Workflow updated successfully");
      setSelectedSource(null);
    } catch (e) {
      // Never leave a drag animation as a false database state. Refresh the
      // authoritative record set after any failed mutation.
      await onRefresh?.();
      toast.error(describeApiError(e, "The update could not be saved. The previous state was restored."));
    } finally {
      setBusyKey("");
      setDraggingId(null);
    }
  };

  const handleDrop = (target) => {
    if (!draggingId) return;
    const source = sourceRows.find((row) => row.id === draggingId);
    applyDrop(source, target);
  };

  const targetText = targetType === "service" ? "service" : "status";

  return (
    <Card className="border-zinc-200 shadow-sm bg-white" data-testid={`drag-workflow-${sourceType}-${targetType}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-heading flex items-center gap-2"><MoveRight className="h-4 w-4 text-royal" />{title}</CardTitle>
            <p className="text-xs text-zinc-500 mt-1">{description}</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <Smartphone className="h-3.5 w-3.5" /> Select a record, then tap/click a target on mobile or keyboard.
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find ${sourceLabel || sourceType}...`} className="pl-9 border-zinc-300" aria-label={`Find ${sourceLabel || sourceType}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_40px_minmax(0,1.6fr)] gap-4 items-stretch">
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 p-3 min-h-32">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Drag source</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {visibleSources.map((row) => {
                const label = getSourceLabel(row);
                const selected = selectedSource === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", row.id); setDraggingId(row.id); setSelectedSource(row.id); }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => setSelectedSource((id) => id === row.id ? null : row.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedSource((id) => id === row.id ? null : row.id); } }}
                    aria-pressed={selected}
                    className={`w-full text-left flex items-center gap-2 rounded-lg border px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 ${selected ? "border-royal bg-royal/5" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
                  >
                    <GripVertical className="h-4 w-4 text-zinc-400 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-800 truncate">{label}</span>
                      <span className="block text-[11px] text-zinc-500 truncate">{row.id}</span>
                    </span>
                    {selected && <Check className="h-4 w-4 text-royal shrink-0" />}
                  </button>
                );
              })}
              {!visibleSources.length && <div className="text-sm text-zinc-500 py-5 text-center">No matching records.</div>}
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center text-zinc-400"><ArrowDown className="h-5 w-5 -rotate-90" /></div>

          <div className="rounded-xl border border-dashed border-royal/40 bg-royal/[0.025] p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Drop target · {targetText}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {normalizedTargets.map(({ raw, label, value }) => {
                const valid = selectedSource ? isValidTarget(sourceRows.find((r) => r.id === selectedSource), raw) : true;
                const busy = busyKey === `${selectedSource}:${value}`;
                return (
                  <button
                    key={String(value)}
                    type="button"
                    disabled={busy || !valid}
                    onDragOver={(e) => { if (draggingId && valid) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(raw); }}
                    onClick={() => { if (selectedSource) applyDrop(sourceRows.find((r) => r.id === selectedSource), raw); else toast.info("Select a source record first."); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (selectedSource) applyDrop(sourceRows.find((r) => r.id === selectedSource), raw); } }}
                    className={`min-h-16 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 ${valid ? "border-zinc-200 bg-white hover:border-royal hover:shadow-sm" : "border-zinc-100 bg-zinc-50 text-zinc-400 cursor-not-allowed"}`}
                    aria-label={`Assign to ${label}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{label}</span>
                      {busy && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                    </span>
                    <span className="text-[11px] text-zinc-500">{valid ? "Drop / select" : "Not valid for this record"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          <span>{selectedSource ? "Source selected — choose a target or drag it onto one." : "Drag a source record onto a valid target."}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onRefresh?.()} className="h-8"><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
        </div>
      </CardContent>
    </Card>
  );
}
