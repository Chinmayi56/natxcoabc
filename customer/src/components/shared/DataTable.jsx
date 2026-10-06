import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Download, Printer, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/shared/EmptyState";
import { exportCSV, exportExcel, exportPDF, printRows } from "@/lib/exports";

export default function DataTable({ columns, rows, loading, pageSize = 8, searchable = true, filters, title = "Data", exportable = true, testId = "data-table" }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: null, dir: 1 });

  const filtered = useMemo(() => {
    let out = rows || [];
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)));
    }
    if (sort.key) {
      out = [...out].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        if (av < bv) return -1 * sort.dir;
        if (av > bv) return 1 * sort.dir;
        return 0;
      });
    }
    return out;
  }, [rows, query, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));

  return (
    <div data-testid={testId}>
      {(searchable || filters) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          {searchable && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                data-testid="table-search"
                placeholder="Search..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="pl-9 border-zinc-300 focus-visible:ring-brand/30"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            {filters}
            {exportable && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="border-zinc-300" data-testid="table-export"><Download className="h-4 w-4 mr-1.5" />Export</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white">
                    <DropdownMenuItem onClick={() => exportPDF(title, columns, filtered)} data-testid="export-pdf"><FileText className="h-4 w-4 mr-2 text-red-500" />Export PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportExcel(title, columns, filtered)} data-testid="export-excel"><FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />Export Excel</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportCSV(title, columns, filtered)} data-testid="export-csv"><FileType className="h-4 w-4 mr-2 text-blue-500" />Export CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => printRows(title, columns, filtered)} data-testid="table-print"><Printer className="h-4 w-4 mr-1.5" />Print</Button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="w-full overflow-x-auto bg-white border border-zinc-200 rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {columns.map((c) => (
                <th key={c.key} className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500 py-3 px-4 whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:text-zinc-800" onClick={() => toggleSort(c.key)}>
                    {c.label}
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  {columns.map((c) => <td key={c.key} className="py-3 px-4"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={columns.length}><EmptyState title="No records found" description="Try adjusting your search or filters." /></td></tr>
            ) : (
              pageRows.map((r, i) => (
                <tr key={r.id || i} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                  {columns.map((c) => (
                    <td key={c.key} className="py-3 px-4 text-zinc-800 whitespace-nowrap">{c.render ? c.render(r) : r[c.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="border-zinc-300" disabled={current <= 1} onClick={() => setPage(current - 1)} data-testid="table-prev"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-3 font-medium text-zinc-700">{current} / {totalPages}</span>
            <Button variant="outline" size="sm" className="border-zinc-300" disabled={current >= totalPages} onClick={() => setPage(current + 1)} data-testid="table-next"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
