import { useState, useEffect } from "react";
import { Target, UserPlus, CheckCircle2, Clock, CalendarCheck, Wallet, Landmark, Building2, FolderKanban, FileText, ClipboardList, Bell } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartCard, LineChartView, BarChartView, DonutChartView } from "@/components/shared/Charts";
import { ActivityFeed, DueDatesWidget } from "@/components/shared/Widgets";
import api, { describeApiError } from "@/lib/api";
import { inr } from "@/lib/utils";
import { toast } from "sonner";

const B="/agent";
export default function AgentDashboard() {
  const [loading,setLoading]=useState(true); const [data,setData]=useState(null);
  const load=async()=>{setLoading(true); try{const r=await api.get("/agent/dashboard");setData(r.data.data);}catch(e){toast.error(describeApiError(e,"Unable to load dashboard"));}finally{setLoading(false);}};
  useEffect(()=>{
    load();
    const onChange = (event) => {
      const resources = event?.detail?.resources || [];
      if (resources.some((r) => ["bookings", "customers", "payments", "commissions", "agents"].includes(r))) load();
    };
    window.addEventListener("ntaxco:data-changed", onChange);
    return () => window.removeEventListener("ntaxco:data-changed", onChange);
  },[]);
  const c=data?.cards||{}, leads=data?.leads||[], commissions=data?.commission_trend||[], projects=data?.projects||[], bookings=data?.bookings||[];
  const cards=[
    {title:"Total Leads",value:c.leads??0,icon:Target,to:`${B}/leads`},{title:"New Leads",value:c.new_leads??0,icon:Target,to:`${B}/leads`},
    {title:"Qualified Leads",value:c.qualified_leads??0,icon:CheckCircle2,to:`${B}/leads`},{title:"Converted Customers",value:c.converted_customers??0,icon:UserPlus,to:`${B}/onboarding`},
    {title:"Pending Follow-ups",value:c.followups??0,icon:Clock,to:`${B}/leads`},{title:"Upcoming Appointments",value:c.appointments??0,icon:CalendarCheck,to:`${B}/appointments`},
    {title:"Commission",value:inr(c.commission),icon:Landmark,to:`${B}/commission`},{title:"Active Customers",value:c.customers??0,icon:Building2,to:`${B}/customers`},
    {title:"Active Projects",value:c.projects??0,icon:FolderKanban,to:`${B}/projects`},{title:"Bookings",value:c.bookings??0,icon:FileText,to:`${B}/bookings`},
    {title:"Notifications",value:c.notifications??0,icon:Bell,to:`${B}/notifications`}
  ];
  const status=[{name:"Completed",value:projects.filter(x=>x.status==="Completed").length},{name:"Running",value:projects.filter(x=>x.status==="Running").length},{name:"Pending",value:projects.filter(x=>x.status==="Pending").length}];
  return <div>
    <PageHeader title="Tax Consultant Dashboard" subtitle="Live overview of your assigned leads, customers and work." breadcrumb={["Tax Consultant","Dashboard"]} />
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">{cards.map((x,i)=><KpiCard key={i} {...x} loading={loading} testId={`kpi-${i}`}/>)}</div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <ChartCard title="Commission Trend (₹)" testId="chart-commission"><BarChartView data={commissions} xKey="period" keys={[{key:"amount",name:"Commission"}]}/></ChartCard>
      <ChartCard title="Project Status" testId="chart-projects"><DonutChartView data={status}/></ChartCard>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ActivityFeed items={[...bookings].slice(0,6).map(b=>({title:`${b.booking_no||b.id} — ${b.service||"Service"}`,time:b.due_date?`Due ${b.due_date}`:"Active",tag:b.status||"Booking"}))}/>
      <DueDatesWidget items={[...leads].filter(x=>x.follow_up_date||x.due_date).slice(0,6).map(x=>({title:x.name||x.business_name||"Follow-up",date:x.follow_up_date||x.due_date,type:"Lead"}))}/>
    </div>
  </div>;
}
