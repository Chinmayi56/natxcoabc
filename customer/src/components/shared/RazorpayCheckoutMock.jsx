import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CreditCard, Smartphone, Landmark, ShieldCheck, Lock, X } from "lucide-react";
import { inr } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const METHODS = [
  { key: "card", label: "Card", icon: CreditCard },
  { key: "upi", label: "UPI", icon: Smartphone },
  { key: "netbanking", label: "Netbanking", icon: Landmark },
];

export default function RazorpayCheckoutMock({ open, amount, name, email, contact, onPay, onClose }) {
  const [method, setMethod] = useState("card");
  const [processing, setProcessing] = useState(false);

  const pay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onPay?.();
    }, 1700);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !processing && onClose?.()}>
      <DialogContent className="p-0 overflow-hidden bg-white max-w-md" data-testid="rzp-modal">
        <DialogTitle className="sr-only">Razorpay Secure Checkout</DialogTitle>
        {/* Razorpay-style header */}
        <div className="bg-[#0A2540] px-5 py-4 flex items-center justify-between relative">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center font-black text-[#0A2540]">N</div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">NTAXCO</p>
              <p className="text-[11px] text-slate-300">Razorpay Secure · Test Mode</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-heading font-extrabold">{inr(amount)}</p>
            <p className="text-[10px] text-slate-300">{contact}</p>
          </div>
          {!processing && (
            <button onClick={() => onClose?.()} className="absolute top-3 right-3 text-slate-300 hover:text-white" data-testid="rzp-close" aria-label="Close checkout"><X className="h-4 w-4" /></button>
          )}
        </div>

        <div className="p-5">
          <div className="flex gap-2 mb-4">
            {METHODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                data-testid={`rzp-method-${m.key}`}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${method === m.key ? "border-[#0A2540] bg-royal-faint text-[#0A2540]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
              >
                <m.icon className="h-4 w-4" />{m.label}
              </button>
            ))}
          </div>

          {method === "card" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div><Label className="text-xs text-zinc-600">Card Number</Label><Input defaultValue="4111 1111 1111 1111" className="mt-1 border-slate-300 font-mono" data-testid="rzp-card" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-zinc-600">Expiry</Label><Input defaultValue="12 / 28" className="mt-1 border-slate-300" /></div>
                <div><Label className="text-xs text-zinc-600">CVV</Label><Input defaultValue="123" type="password" className="mt-1 border-slate-300" /></div>
              </div>
              <div><Label className="text-xs text-zinc-600">Name on Card</Label><Input defaultValue={name || "NTAXCO Customer"} className="mt-1 border-slate-300" /></div>
            </motion.div>
          )}
          {method === "upi" && (
            <div><Label className="text-xs text-zinc-600">UPI ID</Label><Input defaultValue="success@razorpay" className="mt-1 border-slate-300" data-testid="rzp-upi" /></div>
          )}
          {method === "netbanking" && (
            <div><Label className="text-xs text-zinc-600">Select Bank</Label><Input defaultValue="HDFC Bank (Test)" className="mt-1 border-slate-300" /></div>
          )}

          <Button onClick={pay} disabled={processing} className="w-full mt-5 bg-brand text-[#0A2540] hover:bg-brand-hover font-bold h-11" data-testid="rzp-pay-btn">
            {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing payment…</> : <><Lock className="h-4 w-4 mr-2" />Pay {inr(amount)}</>}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-3"><ShieldCheck className="h-3.5 w-3.5" />Secured by Razorpay · Test transaction — no real money is charged</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
