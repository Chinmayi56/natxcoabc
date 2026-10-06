import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const BRAND = [255, 184, 0];
const DARK = [24, 24, 27];

function plain(row, col) {
  if (col.exportValue) return col.exportValue(row);
  const v = row[col.key];
  return v == null ? "" : v;
}
function usableCols(columns) {
  return columns.filter((c) => c.key !== "actions");
}
function triggerDownload(filename, href) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportCSV(title, columns, rows) {
  const cs = usableCols(columns);
  const header = cs.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((r) => cs.map((c) => `"${String(plain(r, c)).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const csv = "\uFEFF" + header + "\n" + body;
  triggerDownload(`${title}.csv`, "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
}

export function exportExcel(title, columns, rows) {
  const cs = usableCols(columns);
  const data = rows.map((r) => {
    const o = {};
    cs.forEach((c) => { o[c.label] = plain(r, c); });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = cs.map((c) => ({ wch: Math.max(12, c.label.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${title}.xlsx`);
}

async function loadBrandLogo() {
  try {
    const response = await fetch("/ntaxco-logo.jpg", { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function pdfHeader(doc, title, logoData) {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, 210, 30, "F");
  if (logoData) {
    try { doc.addImage(logoData, "JPEG", 12, 4, 24, 20, undefined, "FAST"); } catch { /* branding fallback below */ }
  }
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("NTAXCO - Nizam's Tax Consultancy", 40, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Indian Tax • GST • Accounting • Compliance", 40, 18);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 39);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 45);
}

function pdfWatermark(doc) {
  doc.setTextColor(245, 245, 245);
  doc.setFontSize(60);
  doc.setFont("helvetica", "bold");
  doc.text("NTAXCO", 105, 160, { align: "center", angle: 30 });
}

export async function exportPDF(title, columns, rows) {
  const cs = usableCols(columns);
  const doc = new jsPDF();
  const logoData = await loadBrandLogo();
  autoTable(doc, {
    startY: 51,
    head: [cs.map((c) => c.label)],
    body: rows.map((r) => cs.map((c) => String(plain(r, c)))),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    margin: { top: 51, bottom: 18, left: 10, right: 10 },
    didDrawPage: () => {
      pdfWatermark(doc);
      pdfHeader(doc, title, logoData);
      const page = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${page}`, 196, 290, { align: "right" });
      doc.text("© 2026 NTAXCO - Nizam's Tax Consultancy", 14, 290);
    },
  });
  doc.save(`${String(title).replace(/[^a-z0-9_-]+/gi, "_")}.pdf`);
}

export async function exportInvoicePDF(inv) {
  const doc = new jsPDF();
  pdfWatermark(doc);
  const logoData = await loadBrandLogo();
  pdfHeader(doc, `Tax Invoice — ${inv.invoice_no}`, logoData);
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  let y = 52;
  doc.setFont("helvetica", "bold"); doc.text("Bill To:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(inv.customer), 14, y + 6);
  doc.text(`GSTIN: ${inv.gst_number}`, 14, y + 12);
  doc.setFont("helvetica", "bold"); doc.text("Invoice Date:", 150, y);
  doc.setFont("helvetica", "normal"); doc.text(String(inv.invoice_date), 150, y + 6);

  const rows = [
    ["Taxable Amount", `Rs. ${Number(inv.taxable).toLocaleString("en-IN")}`],
    ["Discount", `Rs. ${Number(inv.discount).toLocaleString("en-IN")}`],
    ["CGST", `Rs. ${Number(inv.cgst).toLocaleString("en-IN")}`],
    ["SGST", `Rs. ${Number(inv.sgst).toLocaleString("en-IN")}`],
    ["IGST", `Rs. ${Number(inv.igst).toLocaleString("en-IN")}`],
    ["Grand Total", `Rs. ${Number(inv.total).toLocaleString("en-IN")}`],
  ];
  autoTable(doc, {
    startY: y + 22,
    head: [["Description", "Amount"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: BRAND, textColor: DARK, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (d) => {
      if (d.row.index === rows.length - 1) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [255, 251, 235]; }
    },
  });
  const fy = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(9); doc.setTextColor(110, 110, 110);
  doc.text(`Payment Status: ${inv.payment_status}`, 14, fy);
  doc.text("This is a computer-generated invoice.", 14, fy + 6);
  doc.text("© 2026 Nizam's Tax Consultancy (NTAXCO)", 14, 290);
  doc.save(`${inv.invoice_no}.pdf`);
}

export function printRows(title, columns, rows) {
  const cs = usableCols(columns);
  const w = window.open("", "_blank");
  const style = `<style>
    body{font-family:'IBM Plex Sans',Arial,sans-serif;color:#18181b;padding:24px}
    h1{font-size:20px;border-bottom:4px solid #FFB800;padding-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
    th{background:#18181b;color:#fff;text-align:left;padding:8px}
    td{border-bottom:1px solid #eee;padding:8px}
    tr:nth-child(even){background:#fffbeb}
    .meta{color:#777;font-size:11px}
  </style>`;
  const head = cs.map((c) => `<th>${c.label}</th>`).join("");
  const body = rows.map((r) => `<tr>${cs.map((c) => `<td>${String(plain(r, c))}</td>`).join("")}</tr>`).join("");
  w.document.write(`<html><head><title>${title}</title>${style}</head><body>
    <h1>Nizam's TaX Consultancy — ${title}</h1>
    <p class="meta">Generated: ${new Date().toLocaleString("en-IN")}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
