import { useState, useEffect } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartCard, AreaChartView } from "@/components/shared/Charts";
import DataTable from "@/components/shared/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { inr } from "@/lib/utils";
import { toast } from "sonner";

export default function AccountingDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const res = await api.get("/accounting/summary"); setData(res.data.data); }
      catch (e) { toast.error("Failed to load accounting data"); }
      finally { setLoading(false); }
    })();
  }, []);

  const d = data || { income: 0, expenses: 0, profit: 0, cash_flow: [], pnl: [], balance_sheet: [], trial_balance: [] };

  return (
    <div>
      <PageHeader title="Accounting" breadcrumb={["Super Admin", "Accounting"]} subtitle="Income, expenses, P&L, balance sheet & ledgers." />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Income" value={inr(d.income)} icon={TrendingUp} trend={12} loading={loading} testId="acc-income" />
        <KpiCard title="Total Expenses" value={inr(d.expenses)} icon={TrendingDown} trend={-4} loading={loading} testId="acc-expense" />
        <KpiCard title="Net Profit / Loss" value={inr(d.profit)} icon={Wallet} loading={loading} testId="acc-profit" />
      </div>

      <div className="mb-6">
        <ChartCard title="Cash Flow (₹)" subtitle="Inflow vs Outflow" testId="acc-cashflow">
          <AreaChartView data={d.cash_flow} xKey="m" keys={[{ key: "in", name: "Inflow" }, { key: "out", name: "Outflow" }]} />
        </ChartCard>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList className="bg-zinc-100">
          <TabsTrigger value="pnl" data-testid="tab-pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="bs" data-testid="tab-bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="tb" data-testid="tab-tb">Trial Balance</TabsTrigger>
        </TabsList>
        <TabsContent value="pnl" className="mt-5">
          <DataTable title="Profit and Loss" loading={loading} rows={d.pnl} pageSize={10} searchable={false}
            columns={[{ key: "account", label: "Account" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount", render: (r) => inr(r.amount), exportValue: (r) => r.amount }]} testId="pnl-table" />
        </TabsContent>
        <TabsContent value="bs" className="mt-5">
          <DataTable title="Balance Sheet" loading={loading} rows={d.balance_sheet} pageSize={10} searchable={false}
            columns={[{ key: "item", label: "Item" }, { key: "type", label: "Category" }, { key: "amount", label: "Amount", render: (r) => inr(r.amount), exportValue: (r) => r.amount }]} testId="bs-table" />
        </TabsContent>
        <TabsContent value="tb" className="mt-5">
          <DataTable title="Trial Balance" loading={loading} rows={d.trial_balance} pageSize={10} searchable={false}
            columns={[{ key: "account", label: "Account" }, { key: "debit", label: "Debit", render: (r) => inr(r.debit), exportValue: (r) => r.debit }, { key: "credit", label: "Credit", render: (r) => inr(r.credit), exportValue: (r) => r.credit }]} testId="tb-table" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
