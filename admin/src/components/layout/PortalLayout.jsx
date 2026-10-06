import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Bell, LogOut, Search, ChevronDown, Check, LayoutGrid } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NAV, ROLES } from "@/lib/constants";
import { useDynamicModules } from "@/hooks/useDynamicModules";
import Logo from "@/components/shared/Logo";
import NotificationBell from "@/components/shared/NotificationBell";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";


function SidebarNav({ role, onNavigate }) {
  const location = useLocation();
  const dynamicModules = useDynamicModules(role === "admin", location.pathname);
  const unreadNotifications = useNotificationCount();

  const baseItems = NAV[role] || [];
  let items = baseItems;
  if (role === "admin" && dynamicModules.length > 0) {
    // Admin-created modules (Settings → Modules / Dynamic Configuration)
    // are inserted just above "Settings" so they read as first-class ERP
    // modules rather than an afterthought at the very bottom.
    const dynamicItems = dynamicModules.map((m) => ({
      label: m.name,
      path: `/admin/${m.key}`,
      icon: LayoutGrid,
      dynamic: true,
    }));
    const settingsIdx = baseItems.findIndex((it) => it.path.endsWith("/settings"));
    items = settingsIdx === -1
      ? [...baseItems, ...dynamicItems]
      : [...baseItems.slice(0, settingsIdx), ...dynamicItems, ...baseItems.slice(settingsIdx)];
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {items.map((item) => (
        <NavLink
  key={item.path}
  to={item.path}
  onClick={onNavigate}
  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
  className={({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-royal-faint text-royal"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`
  }
>
  <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
  <span>{item.label}</span>
  {item.path.endsWith("/notifications") && unreadNotifications > 0 && (
    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-royal text-white text-[11px] font-bold flex items-center justify-center" data-testid="nav-notifications-count">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
  )}
</NavLink>
      ))}
    </nav>
  );
}

export default function PortalLayout({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleInfo = ROLES[role];

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate(`/login/${role}`);
  };

  const initials = (user?.name || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen flex bg-background mobile-responsive" data-portal-role={role}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-zinc-200 fixed inset-y-0 left-0 z-30">
        <div className="h-16 flex items-center px-5 border-b border-zinc-100">
          <Logo className="h-11" />
        </div>
        <SidebarNav role={role} />
        <div className="p-3 border-t border-zinc-100">
          <div className="px-3 py-2 rounded-lg bg-zinc-50">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">{roleInfo.label}</p>
            <p className="text-sm font-medium text-zinc-700 truncate">{user?.name}</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" data-testid="mobile-menu-btn"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-white">
                <div className="h-16 flex items-center px-5 border-b border-zinc-100"><Logo className="h-10" /></div>
                <div className="flex flex-col h-[calc(100%-4rem)]">
                  <SidebarNav role={role} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="relative hidden md:block w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input placeholder="Search anything..." className="pl-9 bg-zinc-50 border-zinc-200 focus-visible:ring-brand/30" data-testid="global-search" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell-old-hidden" style={{ display: "none" }} />
              </DropdownMenuTrigger>
            </DropdownMenu>
            <NotificationBell base={roleInfo.base} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-zinc-100 transition-colors" data-testid="user-menu">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-brand text-zinc-900 text-xs font-semibold">{initials}</AvatarFallback></Avatar>
                  <span className="hidden sm:block text-sm font-medium text-zinc-700 max-w-[120px] truncate">{user?.name}</span>
                  <ChevronDown className="h-4 w-4 text-zinc-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium text-zinc-800">{user?.name}</p>
                  <p className="text-xs text-muted-foreground font-normal">{user?.email || user?.mobile}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(`${roleInfo.base}/dashboard`)}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={handleLogout} data-testid="logout-btn">
                  <LogOut className="h-4 w-4 mr-2" />Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
