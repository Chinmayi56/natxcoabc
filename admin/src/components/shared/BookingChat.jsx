import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Send, Loader2, MessageSquare, Headset, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function BookingChat({ booking, open, onOpenChange }) {
  const { user } = useAuth();
  const myRole = user?.role || "customer";
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const bid = booking?.id || booking?.booking_no;

  const load = useCallback(async () => {
    if (!bid) return;
    setLoading(true);
    try { const { data } = await api.get(`/bookings/${bid}/messages`); setMsgs(data.data.messages || []); }
    catch (e) { /* silent */ }
    finally { setLoading(false); }
  }, [bid]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      const { data } = await api.post(`/bookings/${bid}/messages`, { text: t });
      setMsgs((m) => [...m, data.data]);
    } catch (e) { toast.error("Could not send message"); setText(t); }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-lg p-0 overflow-hidden" data-testid="booking-chat">
        <DialogTitle className="sr-only">Booking chat</DialogTitle>
        <div className="bg-[#0A2540] px-5 py-3.5 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-brand flex items-center justify-center text-[#0A2540]"><MessageSquare className="h-4.5 w-4.5" /></div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{booking?.service || "Booking"} · {bid}</p>
            <p className="text-[11px] text-slate-300 truncate">{booking?.customer} · chat with {myRole === "customer" ? "your consultant" : "customer"}</p>
          </div>
        </div>

        <div ref={scrollRef} className="h-[360px] overflow-y-auto p-4 space-y-3 bg-slate-50">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading conversation…</p>
          ) : msgs.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="h-9 w-9 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation about this booking.</p>
            </div>
          ) : msgs.map((m) => {
            const mine = m.sender_role === myRole;
            const isStaff = m.sender_role !== "customer";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${mine ? "bg-[#0A2540] text-white rounded-br-md" : "bg-white border border-slate-200 rounded-bl-md"}`}>
                  {!mine && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-royal mb-1">
                      {isStaff ? <Headset className="h-3 w-3" /> : <User className="h-3 w-3" />}{m.sender_name}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  <span className={`block text-[10px] mt-1 ${mine ? "text-slate-300" : "text-slate-400"}`}>{new Date(m.ts).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-100 flex gap-2 bg-white">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type your message…" disabled={sending} className="border-slate-300" data-testid="booking-chat-input" />
          <Button onClick={send} disabled={sending || !text.trim()} className="bg-brand text-[#0A2540] hover:bg-brand-hover" data-testid="booking-chat-send">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
