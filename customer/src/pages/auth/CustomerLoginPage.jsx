import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Smartphone, Eye, EyeOff, Loader2, ShieldCheck, UserPlus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth, isValidEmail, isValidIndianMobile } from "@/context/AuthContext";
import Logo from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, register, sendOtp, verifyOtp } = useAuth();
  const [mode, setMode] = useState(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "login");
  const [method, setMethod] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === "customer") navigate("/customer", { replace: true });
  }, [user, navigate]);

  const success = (u, message = "Welcome to NTAXCO!") => {
    toast.success(`${message} ${u?.name || ""}`.trim());
    const from = location.state?.from?.pathname;
    navigate(from && from !== "/login" ? from : "/customer", { replace: true });
  };

  const emailLogin = async (e) => {
    e.preventDefault(); setLoading(true);
    try { success(await login(email, password), "Welcome back"); }
    catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  // Synchronous lock so one click == one API call (state updates are async).
  const sendingOtpRef = useRef(false);

  const requestOtp = async () => {
    if (sendingOtpRef.current) return;
    sendingOtpRef.current = true;
    setLoading(true);
    try { await sendOtp(mobile); setOtpSent(true); toast.success("OTP sent to your mobile number."); }
    catch (err) { toast.error(err.message); } finally { sendingOtpRef.current = false; setLoading(false); }
  };

  const otpLogin = async (e) => {
    e.preventDefault(); setLoading(true);
    try { success(await verifyOtp(mobile, otp), "Welcome"); }
    catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const signup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error("Passwords do not match.");
    setLoading(true);
    try {
      await register(name, email, mobile, password);
      toast.success("Account created successfully. You are now signed in.");
      navigate("/customer", { replace: true });
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-royal text-white relative overflow-hidden">
        <Logo className="h-16" />
        <div className="relative">
          <p className="text-sm uppercase tracking-[0.25em] opacity-70 mb-4">Customer Portal</p>
          <h1 className="font-heading text-5xl font-bold leading-tight">Your NTAXCO services, all in one place.</h1>
          <p className="mt-5 text-white/75 max-w-md">Book tax, GST, accounting and compliance services, then track your bookings, documents, invoices and payments securely.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/75"><ShieldCheck className="h-5 w-5" /> Secure backend authentication</div>
      </div>

      <div className="flex items-center justify-center p-5 sm:p-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Logo className="h-16" /></div>

          <button className="text-sm text-zinc-500 hover:text-zinc-900 mb-5" onClick={() => navigate("/customer")}>
            <ArrowLeft className="inline h-4 w-4 mr-1" /> Back to website
          </button>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-royal uppercase tracking-wider">NTAXCO</p>
              <h2 className="font-heading text-3xl font-bold mt-2">{mode === "signup" ? "Create Customer Account" : "Customer Sign In"}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {mode === "signup" ? "Create your account to book and manage NTAXCO services." : "Sign in to access your customer workspace."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-7 p-1 bg-zinc-100 rounded-xl">
            <button type="button" onClick={() => setMode("login")} className={`py-2.5 rounded-lg text-sm font-semibold ${mode === "login" ? "bg-white shadow text-zinc-900" : "text-zinc-500"}`}>
              Sign In
            </button>
            <button type="button" onClick={() => setMode("signup")} className={`py-2.5 rounded-lg text-sm font-semibold ${mode === "signup" ? "bg-white shadow text-zinc-900" : "text-zinc-500"}`}>
              <UserPlus className="inline h-4 w-4 mr-1.5" />Sign Up
            </button>
          </div>

          {mode === "signup" ? (
            <form onSubmit={signup} className="space-y-4 mt-7">
              <div><Label>Customer name</Label><Input className="mt-2" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required /></div>
              <div><Label>Mobile number</Label><Input className="mt-2" inputMode="numeric" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" required /></div>
              <div><Label>Email address</Label><Input className="mt-2" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
              <div><Label>Password</Label><div className="relative mt-2"><Input className="pr-11" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-0 top-0 h-full px-3 text-zinc-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <div><Label>Confirm password</Label><div className="relative mt-2"><Input className="pr-11" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-0 top-0 h-full px-3 text-zinc-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <Button className="w-full bg-brand text-[#0A2540] hover:bg-brand-hover" size="lg" disabled={loading || !isValidEmail(email) || !isValidIndianMobile(mobile)}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : "Create Account"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">Your account is created in the same NTAXCO backend used by the existing customer login.</p>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mt-7 p-1 bg-zinc-100 rounded-xl">
                <button type="button" onClick={() => { setMethod("email"); setOtpSent(false); }} className={`py-2.5 rounded-lg text-sm font-semibold ${method === "email" ? "bg-white shadow text-zinc-900" : "text-zinc-500"}`}><Mail className="inline h-4 w-4 mr-2" />Email</button>
                <button type="button" onClick={() => setMethod("mobile")} className={`py-2.5 rounded-lg text-sm font-semibold ${method === "mobile" ? "bg-white shadow text-zinc-900" : "text-zinc-500"}`}><Smartphone className="inline h-4 w-4 mr-2" />Mobile OTP</button>
              </div>

              {method === "email" ? (
                <form onSubmit={emailLogin} className="space-y-5 mt-7">
                  <div><Label>Email address</Label><Input className="mt-2" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
                  <div><Label>Password</Label><div className="relative mt-2"><Input className="pr-11" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-0 top-0 h-full px-3 text-zinc-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                  <Button className="w-full" size="lg" disabled={loading || !isValidEmail(email)}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : "Sign in"}</Button>
                </form>
              ) : (
                <div className="space-y-5 mt-7">
                  <div><Label>Mobile number</Label><Input className="mt-2" inputMode="numeric" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" /></div>
                  {!otpSent ? <Button type="button" className="w-full" size="lg" onClick={requestOtp} disabled={loading || !isValidIndianMobile(mobile)}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : "Send OTP"}</Button> : <form onSubmit={otpLogin} className="space-y-5"><div><Label>Enter OTP</Label><div className="mt-3 flex justify-center"><InputOTP maxLength={6} value={otp} onChange={setOtp}><InputOTPGroup>{[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup></InputOTP></div></div><Button className="w-full" size="lg" disabled={loading || otp.length < 4}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Verify & Sign in"}</Button><Button type="button" variant="ghost" className="w-full" onClick={() => { setOtpSent(false); setOtp(""); }}>Use another number</Button></form>}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
