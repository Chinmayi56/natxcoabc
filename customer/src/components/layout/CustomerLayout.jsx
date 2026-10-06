import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  Menu, ChevronDown, LogOut, Home, Grid3x3, FileText, BadgeIndianRupee,
  UserCircle, Receipt, FolderOpen, LifeBuoy, LayoutDashboard, Building2,
  CalendarCheck, UserPlus, LogIn, Wallet, BookOpen, Award, ShieldCheck, Calculator
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/shared/Logo";
import NotificationBell from "@/components/shared/NotificationBell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const CUSTOMER_NAV = [
  { label: "Home", path: "/customer", icon: Home, end: true },
  { label: "Dashboard", path: "/customer/dashboard", icon: LayoutDashboard },
  { label: "Income Tax", path: "/customer/income-tax", icon: BadgeIndianRupee },
  { label: "Calculator", path: "/customer/calculator", icon: Calculator, protected: true },
  { label: "My Profile", path: "/customer/profile", icon: UserCircle, protected: true },
  { label: "Invoices", path: "/customer/invoices", icon: Receipt },
  { label: "Support", path: "/customer/support", icon: LifeBuoy, protected: true },
];

const ALL_SERVICES = [
  { title: "Income Tax", icon: BadgeIndianRupee, description: "ITR filing, notices, advance tax and capital gains", items: ["ITR Filing", "Tax Planning", "Refund & Notice Support", "Capital Gains"] },
  { title: "GST", icon: FileText, description: "Registration, monthly filings, refunds and notices", items: ["GST Registration", "GST Return Filing", "GST Reconciliation", "GST Notice Support"] },
  { title: "Company Registration", icon: Building2, description: "Pvt Ltd, LLP, OPC and Partnership formations", items: ["Private Limited", "LLP Registration", "OPC Registration", "Partnership Registration"] },
  { title: "MCA / ROC", icon: FolderOpen, description: "Annual filings, KYC and director changes", items: ["AOC-4", "MGT-7", "Director / KYC"] },
  { title: "Accounting", icon: BookOpen, description: "Bookkeeping, MIS and year-end closing", items: ["Bookkeeping", "MIS Reports", "Year-end Closing"] },
  { title: "Payroll", icon: Wallet, description: "Salary processing, PF and ESI compliance", items: ["Payroll Processing", "PF Compliance", "ESI Compliance"] },
  { title: "Trademark", icon: ShieldCheck, description: "Trademark filing and registration support", items: ["Trademark Registration"] },
  { title: "Licenses", icon: Award, description: "Business licenses and registrations", items: ["MSME / Udyam", "FSSAI", "Shop & Establishment"] },
];

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const navItems = CUSTOMER_NAV;

  const initials = (user?.name || "C").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const handleNav = (item, event) => {
    if (item.protected && !user) {
      event.preventDefault();
      navigate("/login", { state: { from: { pathname: item.path } } });
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/customer", { replace: true });
  };

  const linkCls = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors duration-200 ease-in-out whitespace-nowrap ${
      isActive ? "bg-[#1D4ED8]" : "bg-[#1E40AF] hover:bg-[#2563EB]"
    }`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="min-h-20 sm:min-h-[5.5rem] bg-[#1E40AF] text-white border-b border-[#1E3A8A] sticky top-0 z-40 flex items-center justify-between px-4 sm:px-7 lg:px-10 gap-5">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/customer" aria-label="NTAXCO Home" className="shrink-0">
            <Logo className="h-16 sm:h-[4.5rem]" />
          </Link>
          <nav className="hidden xl:flex items-center gap-1.5 overflow-visible xl:ml-12 2xl:ml-16">
            {navItems.slice(0, 2).map((n) => (
              <NavLink
                key={n.path}
                to={n.path}
                end={n.end}
                onClick={(e) => handleNav(n, e)}
                className={linkCls}
                data-testid={`cnav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {n.label}
              </NavLink>
            ))}
            <div className="relative" onMouseEnter={() => setServicesOpen(true)} onMouseLeave={() => setServicesOpen(false)}>
              <button
                type="button"
                onClick={() => setServicesOpen(v => !v)}
                className={`${linkCls({ isActive: false })} inline-flex items-center gap-1.5`}
                data-testid="cnav-all-services"
              >
                All Services <ChevronDown className={`h-3.5 w-3.5 transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
              </button>
              {servicesOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[760px] z-50">
                  <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6 grid grid-cols-2 gap-x-8 gap-y-6">
                    {ALL_SERVICES.map((service) => (
                      <button key={service.title} type="button" onClick={() => { setServicesOpen(false); navigate("/customer/services"); }} className="text-left flex gap-4 p-2 rounded-xl hover:bg-zinc-50 transition-colors">
                        <span className="h-11 w-11 rounded-xl bg-brand-light text-brand-hover flex items-center justify-center shrink-0"><service.icon className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="block font-heading font-bold text-[#0A2540]">{service.title}</span>
                          <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">{service.description}</span>
                          <span className="block text-xs font-semibold text-[#1E3A8A] mt-2">View services <span aria-hidden="true">→</span></span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {navItems.slice(2).map((n) => (
              <NavLink
                key={n.path}
                to={n.path}
                end={n.end}
                onClick={(e) => handleNav(n, e)}
                className={linkCls}
                data-testid={`cnav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <NotificationBell base="/customer" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg text-white bg-[#1E40AF] hover:bg-[#2563EB] transition-colors duration-200 ease-in-out" data-testid="user-menu">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-brand text-zinc-900 text-xs font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm font-medium text-white max-w-[140px] truncate">{user.name}</span>
                    <ChevronDown className="h-4 w-4 text-white hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white">
                  <DropdownMenuLabel>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground font-normal">{user.mobile || user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/customer/profile")}>
                    <UserCircle className="h-4 w-4 mr-2" />My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={handleLogout} data-testid="logout-btn">
                    <LogOut className="h-4 w-4 mr-2" />Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="ghost" className="text-white bg-[#1E40AF] border border-white/40 hover:bg-[#2563EB] hover:text-white duration-200" onClick={() => navigate("/login")}>
                <LogIn className="h-4 w-4 mr-1.5" />Login
              </Button>
              <Button className="bg-brand text-[#0A2540] hover:bg-brand-hover font-semibold" onClick={() => navigate("/login?mode=signup")}>
                <UserPlus className="h-4 w-4 mr-1.5" />Sign Up
              </Button>
            </div>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="xl:hidden text-white bg-[#1E40AF] hover:bg-[#2563EB] hover:text-white duration-200" data-testid="mobile-menu-btn"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-white w-80">
              <div className="mt-8 mb-5"><Logo className="h-16" /></div>
              <div className="flex flex-col gap-1">
                {navItems.slice(0, 2).map((n) => (
                  <NavLink
                    key={n.path}
                    to={n.path}
                    end={n.end}
                    onClick={(e) => { handleNav(n, e); if (n.protected && !user) return; setOpen(false); }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? "bg-brand-light text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"}`
                    }
                  >
                    <n.icon className="h-[18px] w-[18px]" />{n.label}
                  </NavLink>
                ))}
                <button type="button" onClick={() => { setOpen(false); navigate("/customer/services"); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-100 text-left">
                  <Grid3x3 className="h-[18px] w-[18px]" />All Services
                </button>
                {navItems.slice(2).map((n) => (
                  <NavLink
                    key={n.path}
                    to={n.path}
                    end={n.end}
                    onClick={(e) => { handleNav(n, e); if (n.protected && !user) return; setOpen(false); }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? "bg-brand-light text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"}`
                    }
                  >
                    <n.icon className="h-[18px] w-[18px]" />{n.label}
                  </NavLink>
                ))}
                {!user && (
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={() => { setOpen(false); navigate("/login"); }}><LogIn className="h-4 w-4 mr-1" />Login</Button>
                    <Button className="bg-brand text-[#0A2540]" onClick={() => { setOpen(false); navigate("/login?mode=signup"); }}><UserPlus className="h-4 w-4 mr-1" />Sign Up</Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 animate-fade-up"><Outlet /></main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-muted-foreground bg-white">
        © 2026 Nizam's Tax Consultancy (NTAXCO). All rights reserved.
      </footer>
    </div>
  );
}
