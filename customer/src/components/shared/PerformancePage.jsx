import { useEffect, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartCard, BarChartView } from "@/components/shared/Charts";
import { Star, Target, TrendingUp, CheckCircle2, Award, Landmark } from "lucide-react";
import api, { describeApiError } from "@/lib/api";
import { inr } from "@/lib/utils";
import { toast } from "sonner";

export default function PerformancePage({ role="employee" }) {
 const [loading,setLoading]=useState(true),[data,setData]=useState(null);
 useEffect(()=>{(async()=>{try{const r=await api.get(`/${role}/dashboard`);setData(r.data.data)}catch(e){toast.error(describeApiError(e,"Unable to load performance data"))}finally{setLoading(false)}})()},[role]);
 const c=data?.cards||{};
 const kpis=role==="agent"
 ? [{title:"Leads Generated",value:c.leads??0,icon:Target},{title:"Leads Converted",value:c.converted_customers??0,icon:CheckCircle2},{title:"Customers",value:c.customers??0,icon:TrendingUp},{title:"Commission",value:inr(c.commission),icon:Landmark},{title:"Projects",value:c.projects??0,icon:Award}]
 : [{title:"Performance Score",value:data?.employee?.performance!=null?`${data.employee.performance}/100`:"—",icon:Star},{title:"Projects",value:c.projects??0,icon:CheckCircle2},{title:"Completed Tasks",value:c.completed_tasks??0,icon:Target},{title:"Attendance Days",value:c.attendance_days??0,icon:TrendingUp},{title:"Customers",value:c.customers??0,icon:Award}];
 const bars=role==="agent"?(data?.commission_trend||[]).map(x=>({name:x.period,v:x.amount})):(data?.projects||[]).slice(0,8).map(x=>({name:x.name||x.project_id,v:Number(x.progress||0)}));
 return <div><PageHeader title="Performance" breadcrumb={[role==="agent"?"Tax Consultant":"Employee","Performance"]} subtitle="Performance metrics calculated from your live NTAXCO records."/>
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">{kpis.map((k,i)=><KpiCard key={i} {...k} loading={loading} testId={`perf-kpi-${i}`}/>)}</div>
 <ChartCard title={role==="agent"?"Commission Earned (₹)":"Project Progress"} testId="perf-bars"><BarChartView data={bars} xKey="name" keys={[{key:"v",name:role==="agent"?"Commission":"Progress"}]}/></ChartCard></div>;
}
