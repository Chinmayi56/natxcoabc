import { useState } from "react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const FAQS = [
  { q: "When is my GSTR-3B due?", a: "GSTR-3B is generally due by the 20th of the following month." },
  { q: "How do I download my invoice?", a: "Go to Invoices, open the invoice and click Download PDF." },
  { q: "Can I reschedule a consultation?", a: "Yes, from Projects or by raising a support ticket." },
];

export default function CustomerSupport() {
  const { rows, loading, create } = useCrud("tickets");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "GST", priority: "Medium", ticket_no: "" });

  const submit = async () => {
    if (!form.subject.trim()) { toast.error("Subject is required"); return; }
    await create({ ...form, ticket_no: `TKT-${Math.floor(Math.random() * 900 + 100)}`, status: "Open", created_date: new Date().toISOString().slice(0, 10), reply: "Ticket received. Our team will respond shortly." });
    setOpen(false); setForm({ subject: "", category: "GST", priority: "Medium", ticket_no: "" });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader title="Support Center" breadcrumb={["Customer", "Support"]} subtitle="Raise tickets and get help from your tax experts."
        actions={<Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={() => setOpen(true)} data-testid="raise-ticket"><Plus className="h-4 w-4 mr-1.5" />Raise Ticket</Button>} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-heading text-base font-semibold text-zinc-900">Your Tickets</h3>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : rows.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm" data-testid={`ticket-${t.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.ticket_no} · {t.category} · {t.created_date}</p>
                </div>
                <div className="flex gap-2"><PriorityBadge value={t.priority} /><StatusBadge value={t.status} /></div>
              </div>
              {t.reply && <div className="mt-3 flex gap-2 text-sm bg-zinc-50 border border-zinc-100 rounded-lg p-3"><MessageSquare className="h-4 w-4 text-brand-hover shrink-0 mt-0.5" /><span className="text-zinc-600">{t.reply}</span></div>}
            </motion.div>
          ))}
        </div>
        <div>
          <h3 className="font-heading text-base font-semibold text-zinc-900 mb-3">FAQs</h3>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                <p className="text-sm font-medium text-zinc-900">{f.q}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="font-heading">Raise a Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} className="mt-1.5 border-zinc-300" placeholder="Describe your issue" data-testid="ticket-subject" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((s) => ({ ...s, category: v }))}>
                  <SelectTrigger className="mt-1.5 border-zinc-300"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">{["GST", "Income Tax", "Invoices", "Accounting", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((s) => ({ ...s, priority: v }))}>
                  <SelectTrigger className="mt-1.5 border-zinc-300"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">{["Low", "Medium", "High", "Critical"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-300" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={submit} data-testid="submit-ticket">Submit Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
