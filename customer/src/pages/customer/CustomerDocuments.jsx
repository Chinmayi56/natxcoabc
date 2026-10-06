import { useState } from "react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function CustomerDocuments() {
  const { rows, loading, create, remove } = useCrud("documents");
  const [drag, setDrag] = useState(false);
  const [del, setDel] = useState(null);

  const handleFiles = async (files) => {
    for (const f of Array.from(files)) {
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} is larger than 5 MB`); continue; }
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
      if (!allowed.includes(f.type)) { toast.error(`${f.name} is not a supported document type`); continue; }
      const kb = Math.max(1, Math.round(f.size / 1024));
      const type = f.type.includes("pdf") ? "PDF" : f.type.includes("image") ? "Image" : f.type.includes("sheet") ? "Excel" : "File";
      const fileData = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(f); });
      await create({ name: f.name, category: "Uploads", type, mime_type: f.type, size: `${kb} KB`, uploaded_date: new Date().toISOString().slice(0, 10), version: "v1", file_data: fileData });
    }
    toast.success("Document(s) uploaded");
  };

  const columns = [
    { key: "name", label: "Document" },
    { key: "category", label: "Category" },
    { key: "type", label: "Type", render: (r) => <StatusBadge value={r.type} /> },
    { key: "size", label: "Size" },
    { key: "uploaded_date", label: "Uploaded" },
    { key: "version", label: "Version" },
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (r.file_data) window.open(r.file_data, "_blank", "noopener,noreferrer"); else toast.info(`Preview unavailable for ${r.name}`); }} data-testid={`preview-${r.id}`}><Eye className="h-4 w-4 text-zinc-500" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (r.file_data) { const a = document.createElement("a"); a.href = r.file_data; a.download = r.name; a.click(); } else toast.info(`Download unavailable for ${r.name}`); }} data-testid={`download-${r.id}`}><Download className="h-4 w-4 text-brand-hover" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDel(r.id)} data-testid={`del-${r.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader title="Documents" breadcrumb={["Customer", "Documents"]} subtitle="Upload, preview and manage your business documents." />
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-10 mb-6 cursor-pointer transition-colors ${drag ? "border-brand bg-brand-faint" : "border-zinc-300 bg-white hover:bg-zinc-50"}`}
        data-testid="upload-dropzone"
      >
        <div className="h-12 w-12 rounded-xl bg-brand-faint flex items-center justify-center text-brand-hover"><Upload className="h-6 w-6" /></div>
        <p className="text-sm font-medium text-zinc-800">Drag & drop files here, or click to upload</p>
        <p className="text-xs text-muted-foreground">Supports PDF, JPG, PNG, DOCX, XLSX</p>
        <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} data-testid="file-input" />
      </label>
      <DataTable title="Documents" columns={columns} rows={rows} loading={loading} pageSize={8} testId="documents-table" />

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader><AlertDialogTitle>Delete document?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => { await remove(del); setDel(null); }} data-testid="confirm-del">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
