import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { UserCog, Mail, Phone, MapPin, Hash, Briefcase, Shield, Award } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function ProfilePage({ role = "employee" }) {
  const { user } = useAuth();
  const isAgent = role === "agent";
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (isAgent) return;
    let active = true;
    api.get("/employees/me")
      .then((res) => { if (active) setProfile(res.data?.data || null); })
      .catch(() => { /* no linked employee profile yet */ });
    return () => { active = false; };
  }, [isAgent]);

  const m = user?.meta || {};
  const p = profile || {};

  const fields = [
    { icon: Hash, label: isAgent ? "Agent ID" : "Employee ID", value: p.emp_id || m.agent_id || m.employee_id },
    { icon: Briefcase, label: "Department", value: p.department || m.department },
    { icon: Briefcase, label: "Designation", value: p.designation || m.designation },
    { icon: UserCog, label: "Reporting Manager", value: p.manager || m.manager },
    { icon: Phone, label: "Mobile", value: user?.mobile },
    { icon: Mail, label: "Email", value: p.email || user?.email },
    { icon: MapPin, label: "Address", value: p.address },
    { icon: Award, label: isAgent ? "Performance Rating" : "Performance Score", value: p.performance != null ? `${p.performance} / 100` : null },
    { icon: Shield, label: "PAN", value: p.pan },
    { icon: Award, label: "Assigned Clients", value: p.assigned_clients },
    { icon: Award, label: "Assigned Projects", value: p.assigned_projects },
    { icon: Shield, label: "Status", value: p.status },
  ];
  const initials = (user?.name || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <PageHeader title="My Profile" breadcrumb={[isAgent ? "Tax Consultant" : "Employee", "Profile"]} subtitle="Your personal and employment details." />
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden max-w-4xl">
        <div className="bg-gradient-to-br from-brand-light to-brand-faint p-6 flex items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-white shadow-sm flex items-center justify-center font-heading text-2xl font-bold text-brand-hover">{initials}</div>
          <div>
            <h2 className="font-heading text-xl font-bold text-zinc-900">{user?.name}</h2>
            <p className="text-sm text-zinc-600">{fields[2].value || "—"} · {fields[0].value || "—"}</p>
          </div>
          <Button className="ml-auto bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={() => toast.info("Contact your administrator to change your password.")} data-testid="change-password"><Shield className="h-4 w-4 mr-1.5" />Change Password</Button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-3 py-3 border-b border-zinc-100">
              <f.icon className="h-4 w-4 text-zinc-400 shrink-0" />
              <span className="text-sm text-muted-foreground w-44">{f.label}</span>
              <span className="text-sm font-medium text-zinc-800 ml-auto text-right">{f.value ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
