import { useState, useEffect } from "react";
import { MessageCircle, X, Phone, Mail, CalendarPlus } from "lucide-react";
import { WHATSAPP } from "@/lib/constants";

export default function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  useEffect(() => { const t = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 1200); }, 5000); return () => clearInterval(t); }, []);

  const chat = () => window.open(`https://wa.me/${WHATSAPP.number}?text=${encodeURIComponent(WHATSAPP.message)}`, "_blank");

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-72 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-fade-up" data-testid="whatsapp-card">
          <div className="bg-[#25D366] px-4 py-3 flex items-center justify-between">
            <div><p className="font-heading font-bold text-white">{WHATSAPP.company} Support</p><p className="text-xs text-white/90">{WHATSAPP.responseTime}</p></div>
            <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-white" /></button>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <p className="text-zinc-600">Chat with an NTAXCO Tax Expert for GST, income tax & compliance help.</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{WHATSAPP.phone}</p>
              <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{WHATSAPP.email}</p>
              <p className="flex items-center gap-2"><CalendarPlus className="h-3.5 w-3.5" />{WHATSAPP.hours}</p>
            </div>
            <button onClick={chat} className="w-full bg-[#25D366] hover:bg-[#1da851] text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors" data-testid="start-whatsapp">
              <MessageCircle className="h-4 w-4" />Start WhatsApp Chat
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`h-14 w-14 rounded-full bg-[#25D366] shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform relative ${pulse ? "animate-ping-slow" : ""}`}
        title="Need Help? Chat with an NTAXCO Tax Expert"
        data-testid="whatsapp-button"
      >
        {pulse && <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-40 animate-ping" />}
        <MessageCircle className="h-7 w-7 relative" />
      </button>
    </div>
  );
}
