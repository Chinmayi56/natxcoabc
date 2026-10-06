import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import api, { describeApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UploadCloud, FileSpreadsheet, FileText, X, LoaderCircle, CheckCircle2,
  AlertTriangle, Copy, ArrowLeft, ArrowRight, Download,
} from "lucide-react";

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".pdf"];

const STATUS_META = {
  ready: { label: "Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  duplicate: { label: "Duplicate", className: "bg-amber-50 text-amber-700 border-amber-200" },
  invalid: { label: "Invalid", className: "bg-red-50 text-red-700 border-red-200" },
};

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileIcon(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-5 w-5 text-red-500" />;
  return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
}

export default function ImportCustomersDialog({ open, onOpenChange, onImported }) {
  // step: "upload" | "mapping" | "result"
  const [step, setStep] = useState("upload");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [remapping, setRemapping] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(null); // { columns, suggested_mapping, fields, rows, summary }
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setDragOver(false);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const validateAndSetFile = (f) => {
    if (!f) return;
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error("Unsupported file type. Please upload CSV, XLSX, XLS or PDF.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Please upload a file under 10MB.");
      return;
    }
    setFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    validateAndSetFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Let the browser/Axios set the multipart Content-Type + boundary.
      const { data } = await api.post("/admin/customers/import/preview", formData, {
        headers: { "Content-Type": undefined },
      });
      setPreview(data);
      setMapping(data.suggested_mapping || {});
      setStep("mapping");
    } catch (e) {
      toast.error(describeApiError(e, "Could not read this file"));
    } finally {
      setUploading(false);
    }
  };

  const rawRows = useMemo(() => (preview?.rows || []).map((r) => r.raw), [preview]);

  const applyMappingChange = async (column, fieldKey) => {
    const nextMapping = { ...mapping, [column]: fieldKey === "__none__" ? null : fieldKey };
    setMapping(nextMapping);
    setRemapping(true);
    try {
      const { data } = await api.post("/admin/customers/import/remap", {
        raw_rows: rawRows,
        mapping: nextMapping,
      });
      setPreview((p) => ({ ...p, rows: data.rows, summary: data.summary }));
    } catch (e) {
      toast.error(describeApiError(e, "Could not re-validate the mapping"));
    } finally {
      setRemapping(false);
    }
  };

  const confirmImport = async () => {
    const readyRows = (preview?.rows || []).filter((r) => r.status === "ready").map((r) => r.mapped);
    if (readyRows.length === 0) {
      toast.error("There are no ready rows to import.");
      return;
    }
    setConfirming(true);
    try {
      const { data } = await api.post("/admin/customers/import/confirm", { rows: readyRows });
      setResult(data.summary);
      setStep("result");
      onImported?.();
      window.dispatchEvent(new CustomEvent("ntaxco:data-changed", { detail: { resources: ["customers"] } }));
      toast.success(data.message || "Import complete");
    } catch (e) {
      toast.error(describeApiError(e, "Import failed"));
    } finally {
      setConfirming(false);
    }
  };

  const summary = preview?.summary;
  const fields = preview?.fields || [];

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            Import Customer Data
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV, XLSX, XLS or PDF file of existing customers to import into NTAXCO."}
            {step === "mapping" && "Review the automatic column mapping, then confirm to import into the real database."}
            {step === "result" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-400 bg-blue-50/60" : "border-zinc-300 bg-slate-50 hover:bg-slate-100"}`}
              >
                <UploadCloud className="h-10 w-10 text-blue-500" />
                <div className="text-sm font-semibold text-slate-800">Click to browse or drag and drop a file here</div>
                <div className="text-xs text-zinc-500">Supported formats: CSV, XLSX, XLS, PDF (max 10MB)</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  className="hidden"
                  onChange={(e) => validateAndSetFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  {fileIcon(file.name)}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{file.name}</div>
                    <div className="text-xs text-zinc-500">{formatBytes(file.size)} &middot; {(file.name.split(".").pop() || "").toUpperCase()}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFile(null)} disabled={uploading}>
                  <X className="h-4 w-4 text-zinc-500" />
                </Button>
              </div>
            )}
            <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-blue-800">
              After upload, you'll see a preview with automatic column mapping, validation and duplicate detection.
              Nothing is saved to the database until you review and click <b>Confirm Import</b>.
            </div>
          </div>
        )}

        {step === "mapping" && preview && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                ["Total Rows", summary?.total_rows, "text-slate-900"],
                ["Ready", summary?.ready_rows, "text-emerald-600"],
                ["Duplicates", summary?.duplicate_rows, "text-amber-600"],
                ["Invalid", summary?.invalid_rows, "text-red-600"],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-lg border border-zinc-200 bg-slate-50 p-2.5 text-center">
                  <div className={`text-lg font-bold ${color}`}>{value ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1.5">Column Mapping</div>
              <div className="rounded-lg border border-zinc-200 overflow-hidden">
                <div className="max-h-40 overflow-y-auto divide-y divide-zinc-100">
                  {(preview.columns || []).map((col) => (
                    <div key={col} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1 truncate font-medium text-slate-700">{col}</div>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <Select
                        value={mapping[col] || "__none__"}
                        onValueChange={(v) => applyMappingChange(col, v)}
                        disabled={remapping}
                      >
                        <SelectTrigger className="w-56 h-8 text-xs border-zinc-300"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="__none__">Not mapped</SelectItem>
                          {fields.map((f) => (
                            <SelectItem key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Preview ({preview.rows.length} rows)</div>
                {remapping && <span className="text-[11px] text-zinc-400 flex items-center gap-1"><LoaderCircle className="h-3 w-3 animate-spin" />Re-validating…</span>}
              </div>
              <div className="rounded-lg border border-zinc-200 overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 border-b border-zinc-200 sticky top-0">
                      <tr>
                        <th className="px-2.5 py-2 text-left font-bold text-zinc-500">#</th>
                        <th className="px-2.5 py-2 text-left font-bold text-zinc-500">Business Name</th>
                        <th className="px-2.5 py-2 text-left font-bold text-zinc-500">Email</th>
                        <th className="px-2.5 py-2 text-left font-bold text-zinc-500">Mobile</th>
                        <th className="px-2.5 py-2 text-left font-bold text-zinc-500">Service</th>
                        <th className="px-2.5 py-2 text-left font-bold text-zinc-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r) => {
                        const meta = STATUS_META[r.status] || STATUS_META.invalid;
                        return (
                          <tr key={r.row_number} className="border-b border-zinc-100 last:border-0">
                            <td className="px-2.5 py-1.5 text-zinc-400">{r.row_number}</td>
                            <td className="px-2.5 py-1.5 font-medium text-slate-800">{r.mapped.business_name || "—"}</td>
                            <td className="px-2.5 py-1.5 text-zinc-600">{r.mapped.email || "—"}</td>
                            <td className="px-2.5 py-1.5 text-zinc-600">{r.mapped.mobile || "—"}</td>
                            <td className="px-2.5 py-1.5 text-zinc-600">{r.mapped.service_type || "—"}</td>
                            <td className="px-2.5 py-1.5">
                              <span title={(r.errors || []).join("; ")} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
                                {r.status === "ready" && <CheckCircle2 className="h-3 w-3" />}
                                {r.status === "duplicate" && <Copy className="h-3 w-3" />}
                                {r.status === "invalid" && <AlertTriangle className="h-3 w-3" />}
                                {meta.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="h-8 w-8" /></div>
              <div className="text-base font-bold text-slate-900">Import Complete</div>
              <div className="text-sm text-zinc-500">{result.imported} of {result.total_rows} row(s) were imported into the Customers list.</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Imported", result.imported, "text-emerald-600"],
                ["Duplicates", result.duplicates, "text-amber-600"],
                ["Invalid", result.invalid, "text-red-600"],
                ["Failed", result.failed, "text-zinc-600"],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-lg border border-zinc-200 bg-slate-50 p-2.5 text-center">
                  <div className={`text-lg font-bold ${color}`}>{value ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={upload} disabled={!file || uploading}>
                {uploading ? <><LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" />Reading file…</> : <>Upload &amp; Preview</>}
              </Button>
            </>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
              <Button
                className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
                onClick={confirmImport}
                disabled={confirming || remapping || !summary?.ready_rows}
              >
                {confirming ? <><LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" />Importing…</> : <>Confirm Import ({summary?.ready_rows || 0})</>}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={close}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
