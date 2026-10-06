import PageHeader from "@/components/shared/PageHeader";
import { useCrud } from "@/hooks/useCrud";
import { useAuth } from "@/context/AuthContext";
import DataTable from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";

const CONFIG = {
  gst: { name:"gst", title:"My GST Returns", breadcrumb:["Customer","My GST"], columns:[
    {key:"return_type",label:"Return"},{key:"fy",label:"FY"},{key:"due_date",label:"Due"},{key:"filed_date",label:"Filed"},{key:"ack",label:"Acknowledgement"},{key:"consultant",label:"Consultant"},{key:"status",label:"Status",render:r=><StatusBadge value={r.status}/>}
  ]},
  itr: { name:"itr", title:"Income Tax Returns", breadcrumb:["Customer","Income Tax"], columns:[
    {key:"ay",label:"Assessment Year"},{key:"pan",label:"PAN"},{key:"return_no",label:"Return No"},{key:"filed_date",label:"Filed"},{key:"ack",label:"Acknowledgement"},{key:"consultant",label:"Consultant"},{key:"status",label:"Status",render:r=><StatusBadge value={r.status}/>}
  ]}
};
export default function CustomerReturns({type}) {
 const cfg=CONFIG[type]; const {user}=useAuth(); const {rows,loading}=useCrud(cfg.name);
 return <div className="max-w-6xl mx-auto px-6 py-8"><PageHeader title={cfg.title} breadcrumb={cfg.breadcrumb} subtitle="Live return records from your NTAXCO workspace."/><DataTable title={cfg.title} columns={cfg.columns} rows={rows} loading={loading} pageSize={8} testId={`${type}-returns-table`}/></div>;
}
