import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Search, ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import BookServiceModal from "@/components/shared/BookServiceModal";
import SiteImageGallery from "@/components/shared/SiteImageGallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

const CATEGORY_ORDER = ["Income Tax", "GST", "Company Registration", "MCA / ROC", "Accounting", "Payroll", "Trademark", "Licenses", "Audit", "Consulting", "Other"];

function getCategory(service) {
  const raw = String(service.category || "").toLowerCase();
  const title = String(service.title || service.name || "").toLowerCase();
  if (raw.includes("gst") || title.includes("gst")) return "GST";
  if (raw.includes("income") || title.includes("income") || title.includes("itr") || title.includes("tax")) return "Income Tax";
  if (raw.includes("company") || raw.includes("registration") || title.includes("registration") || title.includes("incorporation")) return raw.includes("company") ? "Company Registration" : "Company Registration";
  if (raw.includes("roc") || raw.includes("mca") || title.includes("roc") || title.includes("mca")) return "MCA / ROC";
  if (raw.includes("account") || title.includes("account") || title.includes("mis")) return "Accounting";
  if (raw.includes("payroll") || title.includes("payroll") || title.includes("pf") || title.includes("esi")) return "Payroll";
  if (raw.includes("trademark") || title.includes("trademark")) return "Trademark";
  if (raw.includes("license") || title.includes("fssai") || title.includes("udyam") || title.includes("shop")) return "Licenses";
  if (raw.includes("audit") || title.includes("audit")) return "Audit";
  if (raw.includes("consult") || title.includes("advis")) return "Consulting";
  return service.category || "Other";
}

export default function CustomerServices() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(!!user);
  const [q, setQ] = useState("");
  const [booking, setBooking] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    // Signed-in customers read the full authenticated catalog (/services);
    // anonymous visitors on the public Customer Site read the read-only,
    // no-login catalog (/public/services) so a service Admin just created,
    // edited, or deactivated shows up immediately for everyone — not only
    // after signing in. Neither list is ever hard-coded per-service.
    const endpoint = user ? "/services" : "/public/services";
    const load = async ({ silent } = {}) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get(endpoint);
        const items = Array.isArray(data?.data) ? data.data : [];
        // Only real services from MongoDB are listed (no hardcoded catalogue). A service must have
        // a real id to be bookable, and inactive/archived services are never offered.
        if (active) {
          setRows(items.filter((s) => s?.id && !["inactive", "archived", "hidden", "disabled"].includes(String(s.status || "active").trim().toLowerCase())));
          setLoadError(false);
        }
      } catch (e) {
        if (active && !silent) { setLoadError(true); toast.error("Unable to load services right now. Please try again."); }
      } finally { if (active && !silent) setLoading(false); }
    };
    load();
    // Real-time sync (section 5/6): this app runs in its own browser
    // context from Admin, so it can't share Admin's in-page refresh event.
    // Poll the backend periodically and update state in place — no full
    // page reload — so newly added/edited/deactivated services propagate
    // here automatically.
    const timer = window.setInterval(() => load({ silent: true }), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user]);

  const filtered = useMemo(() => rows.filter(s => `${s.title || s.name || ""} ${s.category || ""} ${s.description || ""}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach(s => { const cat = getCategory(s); (map[cat] ||= []).push(s); });
    return Object.entries(map).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0]), bi = CATEGORY_ORDER.indexOf(b[0]);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }, [filtered]);

  const startBooking = (service) => {
    if (!user) {
      toast.info("Please sign in or create a customer account to book a service.");
      navigate("/login", { state: { from: { pathname: "/customer/services" } } });
      return;
    }
    // Hand over the whole real service (id + title) so the same record is booked, paid for and tracked.
    setBooking({ id: service.id, title: service.title || service.name });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <PageHeader title="All Services" breadcrumb={["NTAXCO", "All Services"]} subtitle="Explore all tax, GST, accounting, registration and compliance services. Booking requires customer sign in." actions={<div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search services..." className="pl-9 border-zinc-300" /></div>} />
      <SiteImageGallery placement="services" title="Gallery" className="mb-8" container={false} />
      {loading ? <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div> : groups.length === 0 ? <div className="py-16 text-center text-muted-foreground">{loadError ? "Services could not be loaded. Please refresh the page." : rows.length === 0 ? "No services are available right now." : "No services match your search."}</div> : <div className="grid md:grid-cols-2 gap-5">
        {groups.map(([category, items]) => (
          <motion.section key={category} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-zinc-100 bg-gradient-to-r from-brand-faint to-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-brand-light flex items-center justify-center text-brand-hover"><Icons.FileText className="h-5 w-5" /></div>
                <div><p className="font-heading text-lg font-bold text-[#0A2540]">{category}</p><p className="text-xs text-zinc-500 mt-0.5">{items.length} service{items.length !== 1 ? "s" : ""}</p></div>
              </div>
              <span className="text-xs font-semibold text-[#1E3A8A] whitespace-nowrap">View services <ArrowRight className="inline h-3.5 w-3.5 ml-0.5" /></span>
            </div>
            <div className="divide-y divide-zinc-100">
              {items.map((s, i) => {
                const Icon = Icons[s.icon] || Icons.FileText;
                return <motion.article key={`${s.id}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .02 }} className="p-5 flex gap-4 hover:bg-zinc-50 transition-colors">
                  {s.image ? (
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden shrink-0 border border-zinc-200 bg-zinc-100">
                      <img src={s.image} alt={s.title || "Service"} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-brand-light flex items-center justify-center text-brand-hover shrink-0"><Icon className="h-5 w-5" /></div>
                  )}
                  <div className="min-w-0 flex-1"><h3 className="font-heading font-bold text-zinc-900">{s.title || s.name}</h3><p className="text-xs text-zinc-500 mt-1 leading-relaxed">{s.description}</p><div className="flex items-center justify-between gap-3 mt-3"><span className="text-sm font-semibold text-zinc-800">{s.price || "Contact us"}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => navigate(`/customer/services/${s.id}`)}>Details</Button><Button size="sm" onClick={() => startBooking(s)} className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold">Book</Button></div></div></div>
                </motion.article>;
              })}
            </div>
          </motion.section>
        ))}
      </div>}
      {user && <BookServiceModal open={!!booking} onOpenChange={o => !o && setBooking(null)} preselectService={booking} />}
    </div>
  );
}
