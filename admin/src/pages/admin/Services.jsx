import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Power, Archive } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// No service name/category is ever hard-coded here — Admin can add any
// service and every field below is stored as-is on the service record, so
// the same generic Service Module renders it everywhere without a code
// change (section 2/12 of the dynamic-service requirement).
const FREQUENCIES = ["One Time", "Monthly", "Quarterly", "Half-Yearly", "Yearly", "Custom"];
const STATUSES = ["Active", "Inactive", "Archived"];

const EMPTY = {
  title: "", category: "", description: "", short_description: "",
  price: "", discount: "", gst_rate: "18", final_price: "",
  frequency: "One Time", processing_time: "", due_date: "", priority: "Normal",
  pricing_type: "Fixed", assigned_employee: "", assigned_agent: "",
  required_documents: "", customer_requirements: "", notes: "", terms: "",
  image: "", banner_image: "", status: "Active",
};

function computeFinalPrice(form) {
  const price = parseFloat(form.price) || 0;
  const discount = parseFloat(form.discount) || 0;
  const gst = parseFloat(form.gst_rate) || 0;
  const net = Math.max(price - discount, 0);
  return Math.round((net + (net * gst) / 100) * 100) / 100;
}

export default function Services() {
  const { rows, loading, create, update, remove } = useCrud("services");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = { ...form, name: form.title, final_price: form.final_price || computeFinalPrice(form) };
    if (editing) await update(editing, payload); else await create(payload);
    setEditing(null); setForm(EMPTY);
  };

  const edit = (r) => { setEditing(r.id); setForm({ ...EMPTY, ...r, title: r.title || r.name || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const toggleStatus = async (r) => {
    const next = String(r.status || "Active").toLowerCase() === "active" ? "Inactive" : "Active";
    await update(r.id, { status: next });
  };

  const archive = async (r) => update(r.id, { status: "Archived" });

  // Deleting a service that already has customers/bookings/invoices/payments
  // is rejected by the backend (409) to preserve historical records; the
  // hook surfaces that message, so here we just let it try and fall back to
  // suggesting deactivation when it fails.
  const del = async (r) => {
    try { await remove(r.id); }
    catch { /* toasted by useCrud; keep the record and suggest Deactivate/Archive instead */ }
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") list = list.filter((r) => String(r.status || "Active").toLowerCase() === statusFilter);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((r) => `${r.title || r.name} ${r.category} ${r.description}`.toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => String(a.title || a.name || "").localeCompare(String(b.title || b.name || "")));
  }, [rows, q, statusFilter]);

  return <div>
    <PageHeader title="Services" breadcrumb={["Super Admin", "Services"]} subtitle="Create and manage every service shown across Admin, Customer, Employee and Agent — changes here go live everywhere immediately, no code change needed." />
    <form onSubmit={submit} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm mb-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div><Label>Service name *</Label><Input className="mt-1.5" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Trademark Registration" required /></div>
        <div><Label>Category</Label><Input className="mt-1.5" list="ntaxco-service-categories" value={form.category} onChange={e=>set("category",e.target.value)} placeholder="GST, Income Tax, TDS, ROC, Accounting or Others" /><datalist id="ntaxco-service-categories">{["GST","Income Tax","TDS","ROC","Accounting","Others"].map(c=><option key={c} value={c} />)}</datalist></div>
        <div><Label>Frequency</Label>
          <select className="mt-1.5 w-full h-10 rounded-md border border-zinc-300 px-3 text-sm" value={form.frequency} onChange={e=>set("frequency",e.target.value)}>
            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div><Label>Short description</Label><Input className="mt-1.5" value={form.short_description} onChange={e=>set("short_description",e.target.value)} /></div>
        <div className="sm:col-span-2 lg:col-span-2"><Label>Detailed description</Label><Input className="mt-1.5" value={form.description} onChange={e=>set("description",e.target.value)} /></div>
        <div><Label>Price (₹)</Label><Input className="mt-1.5" type="number" value={form.price} onChange={e=>set("price",e.target.value)} placeholder="1999" /></div>
        <div><Label>Discount (₹)</Label><Input className="mt-1.5" type="number" value={form.discount} onChange={e=>set("discount",e.target.value)} placeholder="0" /></div>
        <div><Label>GST / Tax (%)</Label><Input className="mt-1.5" type="number" value={form.gst_rate} onChange={e=>set("gst_rate",e.target.value)} placeholder="18" /></div>
        <div><Label>Final price (auto)</Label><Input className="mt-1.5 bg-zinc-50" readOnly value={`₹${computeFinalPrice(form)}`} /></div>
        <div><Label>Pricing type</Label><Input className="mt-1.5" value={form.pricing_type} onChange={e=>set("pricing_type",e.target.value)} placeholder="Fixed / Per Filing / Custom" /></div>
        <div><Label>Processing time</Label><Input className="mt-1.5" value={form.processing_time} onChange={e=>set("processing_time",e.target.value)} placeholder="e.g. 3-5 business days" /></div>
        <div><Label>Priority</Label><Input className="mt-1.5" value={form.priority} onChange={e=>set("priority",e.target.value)} placeholder="Normal / High / Urgent" /></div>
        <div><Label>Assigned employee</Label><Input className="mt-1.5" value={form.assigned_employee} onChange={e=>set("assigned_employee",e.target.value)} placeholder="Default employee (optional)" /></div>
        <div><Label>Assigned agent</Label><Input className="mt-1.5" value={form.assigned_agent} onChange={e=>set("assigned_agent",e.target.value)} placeholder="Default agent (optional)" /></div>
        <div><Label>Status</Label>
          <select className="mt-1.5 w-full h-10 rounded-md border border-zinc-300 px-3 text-sm" value={form.status} onChange={e=>set("status",e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3"><Label>Required / optional documents</Label><Input className="mt-1.5" value={form.required_documents} onChange={e=>set("required_documents",e.target.value)} placeholder="PAN Card, Aadhaar, Bank Statement (comma separated)" /></div>
        <div className="sm:col-span-2 lg:col-span-3"><Label>Customer requirements</Label><Input className="mt-1.5" value={form.customer_requirements} onChange={e=>set("customer_requirements",e.target.value)} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><Label>Notes</Label><Input className="mt-1.5" value={form.notes} onChange={e=>set("notes",e.target.value)} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><Label>Terms & conditions</Label><Input className="mt-1.5" value={form.terms} onChange={e=>set("terms",e.target.value)} /></div>
        <div>
          <Label>Service image</Label>
          <Input className="mt-1.5" value={form.image} onChange={e=>set("image",e.target.value)} placeholder="https://... (or upload below)" />
          <Input className="mt-1.5" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0]; if(f){const r=new FileReader();r.onload=()=>set("image",String(r.result));r.readAsDataURL(f)}}} />
          {form.image && <div className="mt-2 h-16 w-16 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100"><img src={form.image} alt="Preview" className="h-full w-full object-cover" /></div>}
        </div>
        <div>
          <Label>Banner image / icon</Label>
          <Input className="mt-1.5" value={form.banner_image} onChange={e=>set("banner_image",e.target.value)} placeholder="https://..." />
          <Input className="mt-1.5" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0]; if(f){const r=new FileReader();r.onload=()=>set("banner_image",String(r.result));r.readAsDataURL(f)}}} />
        </div>
      </div>
      <div className="flex gap-2 mt-4"><Button type="submit" className="bg-royal text-white"><Plus className="h-4 w-4 mr-1.5" />{editing ? "Update service" : "Add service"}</Button>{editing && <Button type="button" variant="outline" onClick={()=>{setEditing(null);setForm(EMPTY)}}>Cancel</Button>}</div>
    </form>
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-heading font-bold">Service catalog</h3>
        <div className="flex gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" /><Input className="pl-8 h-9 w-48" placeholder="Search services..." value={q} onChange={e=>setQ(e.target.value)} /></div>
          <select className="h-9 rounded-md border border-zinc-300 px-2 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
          </select>
        </div>
      </div>
      {loading ? <div className="p-6 text-sm text-zinc-500">Loading services...</div> : <div className="divide-y divide-zinc-100">{filtered.map(r=><div key={r.id} className="p-4 flex items-center justify-between gap-4">{r.image && <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 border border-zinc-200 bg-zinc-100"><img src={r.image} alt={r.title||r.name||"Service"} className="h-full w-full object-cover" /></div>}<div className="min-w-0 flex-1"><p className="font-semibold text-zinc-900">{r.title || r.name} <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${String(r.status||"Active").toLowerCase()==="active"?"bg-emerald-50 text-emerald-700":String(r.status||"").toLowerCase()==="archived"?"bg-zinc-100 text-zinc-500":"bg-amber-50 text-amber-700"}`}>{r.status || "Active"}</span></p><p className="text-xs text-zinc-500">{r.category || "General"} · {r.frequency || "One Time"} · {r.final_price ? `₹${r.final_price}` : (r.price || "Price on request")}</p><p className="text-sm text-zinc-600 mt-1">{r.short_description || r.description || "No description"}</p></div><div className="flex gap-2 shrink-0"><Button variant="outline" size="sm" onClick={()=>toggleStatus(r)} title="Activate/Deactivate"><Power className="h-4 w-4 mr-1"/>{String(r.status||"Active").toLowerCase()==="active" ? "Deactivate" : "Activate"}</Button><Button variant="outline" size="sm" onClick={()=>archive(r)} title="Archive (preserves history)"><Archive className="h-4 w-4 mr-1"/>Archive</Button><Button variant="outline" size="sm" onClick={()=>edit(r)}><Pencil className="h-4 w-4 mr-1"/>Edit</Button><Button variant="outline" size="sm" onClick={()=>del(r)}><Trash2 className="h-4 w-4 mr-1"/>Delete</Button></div></div>)}{!filtered.length && <div className="p-6 text-sm text-zinc-500">No services found.</div>}</div>}
    </div>
  </div>;
}
