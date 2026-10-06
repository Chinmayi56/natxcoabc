import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Users, Building2, UserCog, ArrowRight, CheckCircle2 } from "lucide-react";
import Logo from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";

const PORTALS = [
  { role: "admin", label: "Super Admin", icon: ShieldCheck, desc: "Manage the entire ERP, teams, finances & compliance.", tag: "Email or Mobile OTP" },
  { role: "employee", label: "Employee", icon: Users, desc: "Attendance, tasks, projects & assigned clients.", tag: "Mobile OTP" },
  { role: "customer", label: "Customer", icon: Building2, desc: "Track GST, ITR, invoices, payments & documents.", tag: "Mobile OTP" },
  { role: "agent", label: "Tax Consultant", icon: UserCog, desc: "Leads, onboarding, appointments & clients.", tag: "Mobile OTP" },
];

const SERVICES = ["GST", "Income Tax", "TDS", "Accounting", "Payroll", "ROC", "Audit", "Trademark"];

export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-5 sm:px-10">
        <Logo className="h-9" />
        <span className="text-xs sm:text-sm text-muted-foreground font-medium">Indian Tax • GST • Accounting • Compliance</span>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-hover bg-brand-faint px-3 py-1.5 rounded-full">
            Enterprise ERP Platform
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-zinc-900 mt-5 leading-[1.05]">
            One platform for your entire<br /><span className="text-brand-hover">tax & compliance</span> practice.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-2xl">
            NTAXCO ERP unifies GST filing, income tax, accounting, payroll, and compliance across dedicated portals for admins, employees, customers and agents.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {SERVICES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 px-2.5 py-1 rounded-md">
                <CheckCircle2 className="h-3 w-3 text-brand-hover" />{s}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <h2 className="font-heading text-lg font-semibold text-zinc-900 mb-1">Choose your portal</h2>
          <p className="text-sm text-muted-foreground mb-6">Select how you'd like to sign in.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PORTALS.map((p, i) => (
              <motion.button
                key={p.role}
                data-testid={`portal-card-${p.role}`}
                onClick={() => navigate(`/login/${p.role}`)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="group text-left bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand transition-[box-shadow,border-color] focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <div className="h-12 w-12 rounded-xl bg-brand-faint flex items-center justify-center text-brand-hover group-hover:bg-brand group-hover:text-zinc-900 transition-colors">
                  <p.icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="font-heading text-lg font-bold text-zinc-900 mt-4">{p.label}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 min-h-[40px]">{p.desc}</p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
                  <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{p.tag}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-hover">
                    Login <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-muted-foreground">
        © 2026 Nizam's Tax Consultancy (NTAXCO).
      </footer>
    </div>
  );
}
