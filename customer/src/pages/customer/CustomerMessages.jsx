import { useState, useEffect } from "react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, Headset } from "lucide-react";
import { toast } from "sonner";

export default function CustomerMessages() {
  const { rows, loading } = useCrud("tickets");
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");

  useEffect(() => { if (!active && rows.length) setActive(rows[0]); }, [rows, active]);

  const send = () => {
    if (!text.trim()) return;
    toast.success("Message sent to your consultant");
    setText("");
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <PageHeader title="Messages" breadcrumb={["Customer", "Messages"]} subtitle="Chat with your assigned NTAXCO consultant about your services." />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-royal" /><p className="font-heading font-semibold text-sm text-zinc-900">Conversations</p></div>
          <div className="divide-y divide-zinc-100 max-h-[460px] overflow-y-auto">
            {loading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : rows.map((t) => (
              <button key={t.id} onClick={() => setActive(t)} className={`w-full text-left px-4 py-3 hover:bg-zinc-50 ${active?.id === t.id ? "bg-royal-faint/40" : ""}`} data-testid={`msg-thread-${t.id}`}>
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-zinc-900 truncate">{t.subject}</p><StatusBadge value={t.status} /></div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{t.category} · {t.created_date}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col min-h-[520px]">
          {active ? (
            <>
              <div className="px-5 py-3 border-b border-zinc-100"><p className="font-heading font-semibold text-zinc-900">{active.subject}</p><p className="text-xs text-muted-foreground">Ticket {active.ticket_no} · {active.category}</p></div>
              <div className="flex-1 p-5 space-y-3 overflow-y-auto bg-slate-50">
                <div className="flex justify-end"><div className="bg-royal text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm max-w-[75%]">{active.subject}</div></div>
                <div className="flex justify-start"><div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm max-w-[75%]"><span className="flex items-center gap-1.5 text-xs font-semibold text-royal mb-1"><Headset className="h-3 w-3" />NTAXCO Consultant</span>{active.reply}</div></div>
              </div>
              <div className="p-3 border-t border-zinc-100 flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type your message…" className="border-zinc-300" data-testid="msg-input" />
                <Button className="bg-royal text-white hover:bg-royal-hover" onClick={send} data-testid="msg-send"><Send className="h-4 w-4" /></Button>
              </div>
            </>
          ) : <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div>}
        </div>
      </div>
    </div>
  );
}
