import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, FileText, BadgeIndianRupee, BookOpen, Wallet, ScrollText, Building2,
  ShieldCheck, TrendingUp, CalendarPlus, CheckCircle2, Star, Quote, Mail, MapPin,
  Award, Clock3, Users, Headset, Sparkles, LogIn, UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import BookServiceModal from "@/components/shared/BookServiceModal";
import SiteImageGallery from "@/components/shared/SiteImageGallery";
import { useHomeImages } from "@/hooks/useHomeImages";
import { WHATSAPP } from "@/lib/constants";

// Defaults for the 3 existing Home page images — used until (and unless) an
// admin overrides them from Admin → Settings → Images → Home Page Images.
const DEFAULT_HOME_IMAGES = {
  customer_home_image_1: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?crop=entropy&cs=srgb&fm=jpg&q=85",
  customer_home_image_2: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=srgb&fm=jpg&q=85",
  customer_home_image_3: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?crop=entropy&cs=srgb&fm=jpg&q=85",
};

const STATS = [
  { label: "Happy Clients", value: 1240, suffix: "+" },
  { label: "Returns Filed", value: 8600, suffix: "+" },
  { label: "Years Experience", value: 12, suffix: "" },
  { label: "Client Satisfaction", value: 98, suffix: "%" },
];

const WHY = [
  { icon: Award, title: "Expert CAs & Consultants", desc: "A professional team of qualified chartered accountants and tax experts." },
  { icon: Clock3, title: "On-time Compliance", desc: "Stay ahead of GST, ITR, TDS and ROC deadlines with proactive support." },
  { icon: ShieldCheck, title: "Secure & Confidential", desc: "Your business information and documents are handled with care." },
  { icon: Headset, title: "Dedicated Support", desc: "Get clear guidance from a responsive professional support team." },
];

const SERVICES = [
  { icon: FileText, title: "GST Services", desc: "Registration, returns, reconciliation and GST compliance.", tag: "Popular" },
  { icon: BadgeIndianRupee, title: "Income Tax", desc: "ITR filing, tax planning, refunds and notices." },
  { icon: BookOpen, title: "Accounting", desc: "Bookkeeping, ledgers and financial statements." },
  { icon: Wallet, title: "Payroll", desc: "Salary, PF, ESI and payslip management." },
  { icon: ScrollText, title: "ROC Compliance", desc: "AOC-4, MGT-7 and annual MCA filings." },
  { icon: Building2, title: "Registrations", desc: "Company, LLP, MSME and startup setup." },
  { icon: ShieldCheck, title: "Audit", desc: "Statutory, internal and tax audit services." },
  { icon: TrendingUp, title: "Consulting", desc: "Strategic financial and business advisory." },
];

const TESTIMONIALS = [
  { name: "Rahul Agarwal", company: "ABC Industries Pvt Ltd", text: "NTAXCO transformed our GST compliance. Filings are always on time and the process is easy to track.", initials: "RA" },
  { name: "Meera Nair", company: "TechNova Solutions", text: "Their ROC and audit team is professional, proactive and always clear with the next steps.", initials: "MN" },
  { name: "Suresh Rao", company: "Sai Enterprises", text: "Income tax filing used to be stressful. NTAXCO made the entire process simple and smooth.", initials: "SR" },
];

function Counter({ to, suffix = "" }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => entry.isIntersecting && setStarted(true), { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(to / 55));
    const timer = setInterval(() => {
      current += step;
      if (current >= to) { current = to; clearInterval(timer); }
      setN(current);
    }, 25);
    return () => clearInterval(timer);
  }, [started, to]);
  return <span ref={ref}>{n.toLocaleString("en-IN")}{suffix}</span>;
}

export default function CustomerLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState(false);
  const IMG = useHomeImages(DEFAULT_HOME_IMAGES);

  const startBooking = () => {
    if (!user) { navigate("/login", { state: { from: { pathname: "/customer" } } }); return; }
    setBooking(true);
  };

  const marqueeServices = [...SERVICES, ...SERVICES];
  const marqueeStories = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <div className="bg-white">
      {user && (
        <section className="bg-[#F8FAFC] border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs uppercase tracking-[0.18em] font-semibold text-royal">Customer Workspace</p><p className="text-sm text-slate-600 mt-0.5">Welcome back, {user.name?.split(" ")[0] || "Customer"}.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={startBooking} className="bg-brand text-[#0A2540] hover:bg-brand-hover font-semibold"><CalendarPlus className="h-4 w-4 mr-1.5" />Book a Service</Button>
              <Button variant="outline" className="border-slate-300" onClick={() => navigate("/customer/documents")}><FileText className="h-4 w-4 mr-1.5" />Upload Docs</Button>
            </div>
          </div>
        </section>
      )}

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0A2540]">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-[#FFB800]/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-[#1E3A8A]/40 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFB800] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              <Sparkles className="h-3 w-3" /> Your Trusted Tax Partner Since 2014
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-white mt-5 leading-[1.05] tracking-tight">
              Compliance made <span className="text-[#FFB800]">effortless</span> for your business.
            </motion.h1>
            <p className="text-slate-300 mt-5 max-w-xl text-base sm:text-lg leading-relaxed">
              GST, income tax, accounting, payroll and ROC services managed by experienced professionals on one simple platform built for Indian businesses.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Button onClick={startBooking} className="bg-[#FFB800] text-[#0A2540] hover:bg-[#E5A600] font-bold h-12 px-6">
                <CalendarPlus className="h-4 w-4 mr-2" />Book a Service
              </Button>
              {!user && <Button onClick={() => navigate("/login")} variant="outline" className="h-12 px-6 border-white/25 bg-white/5 text-white hover:bg-white/10 font-semibold"><LogIn className="h-4 w-4 mr-2" />Customer Login</Button>}
              {user && <Button onClick={() => navigate("/customer/dashboard")} variant="outline" className="h-12 px-6 border-white/25 bg-white/5 text-white hover:bg-white/10 font-semibold">Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" /></Button>}
            </div>
            <div className="flex items-center gap-5 mt-8 text-slate-300 text-sm">
              <div className="flex items-center gap-1.5"><Star className="h-4 w-4 text-[#FFB800] fill-[#FFB800]" /> 4.9/5 rating</div>
              <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-[#FFB800]" /> 1,240+ clients</div>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={IMG.customer_home_image_1} alt="NTAXCO consulting team" className="w-full h-[380px] object-cover" />
            </div>
            <div className="absolute -bottom-5 -left-5 bg-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#FFB800]/15 flex items-center justify-center text-[#0A2540]"><FileText className="h-5 w-5" /></div>
              <div><p className="font-heading font-extrabold text-[#0A2540] text-lg leading-none">8,600+</p><p className="text-xs text-slate-500 mt-0.5">Returns Filed</p></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* QUICK ONLINE ITR FILING */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-7 sm:p-10 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E3A8A]">Quick Online ITR Filing</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-[#0A2540] mt-3">File your income tax return with confidence</h2>
            <p className="text-slate-500 mt-4 leading-relaxed">Simple online filing support from experienced tax professionals, with clear guidance from document collection to submission.</p>
            <Button onClick={startBooking} className="mt-7 bg-[#FFB800] text-[#0A2540] hover:bg-[#E5A600] font-bold h-11 px-6"><CalendarPlus className="h-4 w-4 mr-2" />Book ITR Service</Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Get Maximum Tax Refund",
              "Income Tax Experts",
              "Expert Tax Compliance",
              "Easy Tax Filing",
              "Trusted Tax Experts",
            ].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-4 shadow-sm"><CheckCircle2 className="h-5 w-5 text-[#FFB800] shrink-0" /><span className="font-semibold text-[#0A2540] text-sm">{item}</span></div>)}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-[#051324]">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((s) => <div key={s.label} className="text-center"><p className="font-heading text-4xl sm:text-5xl font-black text-[#FFB800]"><Counter to={s.value} suffix={s.suffix} /></p><p className="text-sm text-slate-300 mt-2">{s.label}</p></div>)}
        </div>
      </section>

      {/* WHY */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E3A8A]">Why Choose Nizam's Tax</p>
        <h2 className="font-heading text-3xl sm:text-4xl font-black text-[#0A2540] mt-3 tracking-tight">A tax partner your business can rely on</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {WHY.map((w, i) => <motion.div key={w.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .06 }} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="h-12 w-12 rounded-xl bg-[#0A2540] flex items-center justify-center text-[#FFB800]"><w.icon className="h-6 w-6" /></div>
            <h3 className="font-heading text-lg font-bold text-[#0A2540] mt-4">{w.title}</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{w.desc}</p>
          </motion.div>)}
        </div>
      </section>

      {/* ADMIN-CURATED IMAGES */}
      <section className="py-16">
        <SiteImageGallery placement="home" title="Featured" />
      </section>

      {/* MOVING SERVICES */}
      <section className="bg-[#F8FAFC] border-y border-slate-200 py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E3A8A]">Our Services</p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-[#0A2540] mt-3">Everything your business needs to stay compliant</h2>
          <p className="text-slate-500 mt-3 max-w-2xl">Explore our services. Select any service to view its details, then sign in when you are ready to book.</p>
        </div>
        <div className="mt-10 overflow-hidden">
          <div className="ntaxco-marquee-track ntaxco-marquee-left">
            {marqueeServices.map((f, i) => (
              <button key={`${f.title}-${i}`} onClick={() => navigate("/customer/services")} className="relative shrink-0 w-[300px] sm:w-[360px] min-h-[210px] text-left bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-xl hover:border-[#FFB800] transition-all">
                {f.tag && <span className="absolute top-5 right-5 text-[10px] font-bold uppercase tracking-wider text-[#0A2540] bg-[#FFB800] px-2 py-1 rounded-full">{f.tag}</span>}
                <div className="h-14 w-14 rounded-xl bg-[#FFB800]/15 flex items-center justify-center text-[#0A2540]"><f.icon className="h-7 w-7" /></div>
                <h3 className="font-heading text-lg font-bold text-[#0A2540] mt-5">{f.title}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{f.desc}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E3A8A] mt-4">View service <ArrowRight className="h-3.5 w-3.5" /></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* BUSINESS INSIGHT */}
      <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xl"><img src={IMG.customer_home_image_2} alt="Financial analytics" className="w-full h-[360px] object-cover" /></div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E3A8A]">Professional Service</p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-[#0A2540] mt-3">One place for your tax and compliance needs</h2>
          <p className="text-slate-500 mt-4 leading-relaxed">Once you create your customer account, you can book services and securely manage your bookings, GST, income tax, projects, invoices, payments and documents.</p>
          <ul className="mt-6 space-y-3">
            {["GST, ITR, TDS and ROC compliance support", "Professional service tracking", "Secure document and invoice management", "Clear payment and booking history"].map(t => <li key={t} className="flex items-start gap-2.5 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 text-[#FFB800] shrink-0" />{t}</li>)}
          </ul>
          <Button onClick={() => navigate(user ? "/customer/dashboard" : "/login")} className="mt-7 bg-[#0A2540] text-white hover:bg-[#1E3A8A] font-semibold h-11 px-6">{user ? "Open Dashboard" : "Create Customer Account"} <ArrowRight className="h-4 w-4 ml-2" /></Button>
        </div>
      </section>

      {/* MOVING CLIENT STORIES */}
      <section className="bg-[#F8FAFC] border-y border-slate-200 py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E3A8A]">Client Stories</p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-[#0A2540] mt-3">Trusted by growing Indian businesses</h2>
        </div>
        <div className="mt-12 overflow-hidden">
          <div className="ntaxco-marquee-track ntaxco-marquee-right">
            {marqueeStories.map((t, i) => <div key={`${t.name}-${i}`} className="shrink-0 w-[320px] sm:w-[410px] bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
              <Quote className="h-8 w-8 text-[#FFB800]/50" />
              <div className="flex gap-0.5 mt-3">{[0,1,2,3,4].map(s => <Star key={s} className="h-4 w-4 text-[#FFB800] fill-[#FFB800]" />)}</div>
              <p className="text-sm text-slate-700 mt-4 leading-relaxed">"{t.text}"</p>
              <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
                <div className="h-11 w-11 rounded-full bg-[#0A2540] text-[#FFB800] flex items-center justify-center font-bold text-sm">{t.initials}</div>
                <div><p className="font-semibold text-[#0A2540] text-sm">{t.name}</p><p className="text-xs text-slate-500">{t.company}</p></div>
              </div>
            </div>)}
          </div>
        </div>
      </section>

      {/* ABOUT / CONTACT */}
      <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E3A8A]">About NTAXCO</p><h2 className="font-heading text-3xl sm:text-4xl font-black text-[#0A2540] mt-3">Professional support for growing businesses</h2><p className="text-slate-500 mt-4 leading-relaxed">From routine compliance to registrations, accounting and advisory, NTAXCO helps businesses keep their financial responsibilities organized and on time.</p><div className="flex flex-wrap gap-3 mt-7"><Button onClick={startBooking} className="bg-brand text-[#0A2540] hover:bg-brand-hover font-bold"><CalendarPlus className="h-4 w-4 mr-2" />Book a Service</Button>{!user && <Button variant="outline" onClick={() => navigate("/login?mode=signup")}><UserPlus className="h-4 w-4 mr-2" />Create Account</Button>}</div></div>
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg"><img src={IMG.customer_home_image_3} alt="NTAXCO office" className="w-full h-[330px] object-cover" /></div>
      </section>

      <section className="relative overflow-hidden bg-[#0A2540]">
        <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div><h2 className="font-heading text-3xl sm:text-4xl font-black text-white">Ready to simplify your compliance?</h2><p className="text-slate-300 mt-4">Create a customer account to book services and manage everything from one secure workspace.</p><Button onClick={startBooking} className="mt-7 bg-[#FFB800] text-[#0A2540] hover:bg-[#E5A600] font-bold h-12 px-6"><CalendarPlus className="h-4 w-4 mr-2" />Book a Service</Button></div>
          <div className="grid sm:grid-cols-2 gap-4">{[{icon: Mail,label:"Email",value:WHATSAPP.email},{icon: MapPin,label:"Office",value:"HITEC City, Hyderabad"},{icon: Clock3,label:"Hours",value:WHATSAPP.hours},{icon: Users,label:"Clients",value:"1,240+ businesses"}].map(c => <div key={c.label} className="rounded-xl bg-white/5 border border-white/10 p-5"><c.icon className="h-5 w-5 text-[#FFB800]" /><p className="text-xs text-slate-400 mt-3 uppercase tracking-wider">{c.label}</p><p className="text-white font-medium mt-1 text-sm">{c.value}</p></div>)}</div>
        </div>
      </section>

      {user && <BookServiceModal open={booking} onOpenChange={setBooking} />}
    </div>
  );
}
