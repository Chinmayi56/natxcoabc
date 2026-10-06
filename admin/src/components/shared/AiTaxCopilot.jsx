import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const QUICK = [
  "Calculate GST @18% on ₹2,50,000",
  "Estimate income tax for ₹25 lakh",
  "Explain TDS on professional fees",
  "Which ITR should I file?",
  "Documents needed for GST filing",
];

const WELCOME = {
  role: "assistant",
  content:
    "Hi! I'm the NTAXCO AI Tax Copilot. Ask me about GST, Income Tax, TDS, ITR selection, document requirements or project tax estimates — all in ₹.",
};

export default function AiTaxCopilot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef(
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading, open]);

  useEffect(() => {
    const handler = (e) => {
      setOpen(true);
      const p = e.detail?.prompt;
      if (p) setInput(p);
    };
    window.addEventListener("ntaxco:open-copilot", handler);
    return () => window.removeEventListener("ntaxco:open-copilot", handler);
  }, []);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/copilot/chat", { message: q, session_id: sessionRef.current });
      setMsgs((m) => [...m, { role: "assistant", content: data.data.reply }]);
    } catch (e) {
      const err = formatApiError(e.response?.data?.detail) || "The AI assistant is unavailable right now.";
      toast.error(err);
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry, I couldn't process that just now. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-[92vw] sm:w-[380px] h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            data-testid="copilot-panel"
          >
            {/* Header */}
            <div className="bg-[#0A2540] px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative h-9 w-9 rounded-xl bg-[#FFB800] flex items-center justify-center">
                  <Sparkles className="h-4.5 w-4.5 text-[#0A2540]" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0A2540]" />
                </div>
                <div>
                  <p className="font-heading font-bold text-white text-sm leading-tight">AI Tax Copilot</p>
                  <p className="text-[11px] text-slate-300">Powered by NTAXCO · Online</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} data-testid="copilot-close" className="text-slate-300 hover:text-white transition-colors"><X className="h-4.5 w-4.5" /></button>
            </div>

            {/* Chat body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`text-sm rounded-2xl px-3.5 py-2.5 max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-sm ${
                      m.role === "user"
                        ? "bg-[#0A2540] text-white rounded-br-md"
                        : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-1.5">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="h-2 w-2 rounded-full bg-[#1E3A8A]/50"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick prompts */}
            {msgs.length <= 1 && !loading && (
              <div className="px-3 pb-2 pt-1 flex flex-wrap gap-1.5 bg-slate-50">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)} className="text-[11px] bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-600 hover:border-[#FFB800] hover:text-[#0A2540] transition-colors" data-testid="copilot-quick">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-slate-100 flex gap-2 bg-white">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask about GST, tax, TDS…"
                disabled={loading}
                className="flex-1 text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FFB800]/40 disabled:opacity-60"
                data-testid="copilot-input"
              />
              <button onClick={() => send()} disabled={loading || !input.trim()} className="h-10 w-10 rounded-xl bg-[#FFB800] text-[#0A2540] flex items-center justify-center hover:bg-[#E5A600] transition-colors disabled:opacity-50" data-testid="copilot-send">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        className="h-14 w-14 rounded-full bg-[#0A2540] shadow-xl flex items-center justify-center text-[#FFB800] hover:scale-110 transition-transform ring-4 ring-[#0A2540]/10"
        title="AI Tax Copilot"
        data-testid="copilot-button"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
      </button>
    </div>
  );
}
