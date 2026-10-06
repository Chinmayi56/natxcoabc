import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ShieldCheck, Users, Briefcase, Mail, Smartphone, Eye, EyeOff,
  Loader2, KeyRound, RotateCcw, ScrollText, Building2, HeartHandshake,
  UserPlus, CheckCircle2,
} from "lucide-react";
import { useAuth, isValidEmail, isValidIndianMobile } from "@/context/AuthContext";
import { landingPath } from "@/lib/constants";
import Logo from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const PORTALS = [
  {
    key: "admin",
    label: "Super Admin",
    icon: ShieldCheck,
    description: "Manage employees, customers, finance, projects and business operations.",
  },
  {
    key: "employee",
    label: "Employee",
    icon: Users,
    description: "Manage attendance, tasks, clients, payroll and performance.",
  },
  {
    key: "agent",
    label: "Agent",
    icon: Briefcase,
    description: "Manage leads, bookings, customers and commissions.",
  },
];

const HIGHLIGHTS = [
  { icon: ScrollText, text: "Tax Services" },
  { icon: ShieldCheck, text: "Compliance" },
  { icon: HeartHandshake, text: "Business Support" },
  { icon: Building2, text: "ERP Management" },
];

const emailSchema = z.object({
  email: z.string().min(1, "Email is required").refine(isValidEmail, "Please enter a valid email address."),
  password: z.string().min(1, "Password is required"),
});

const mobileOnlySchema = z.object({
  mobile: z.string().refine(isValidIndianMobile, "Please enter a valid 10-digit Indian mobile number."),
});

// Registration — Full Name, Email, optional Mobile, Password, Confirm
// Password. Mirrors the backend's own validation (server.py's
// /auth/register: name required, email valid, password >= 8 chars,
// mobile must be a valid 10-digit Indian number when supplied) so bad
// input is caught client-side before it ever reaches the API.
const registerSchema = z
  .object({
    full_name: z.string().trim().min(1, "Full name is required."),
    email: z.string().min(1, "Email is required").refine(isValidEmail, "Please enter a valid email address."),
    mobile: z
      .string()
      .optional()
      .refine((v) => !v || isValidIndianMobile(v), "Please enter a valid 10-digit Indian mobile number."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function digitsOnly(value, max) {
  return String(value || "").replace(/\D/g, "").slice(0, max);
}

function PasswordInput({ registration, testId, placeholder = "••••••••", error }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="relative">
        <Input
          {...registration}
          type={visible ? "text" : "password"}
          data-testid={testId}
          placeholder={placeholder}
          className="pr-10 border-slate-300 focus-visible:ring-brand/50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 h-full px-3 flex items-center text-slate-400 hover:text-slate-700"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  const { role: roleParam } = useParams();
  const navigate = useNavigate();
  const { adminEmailLogin, portalEmailLogin, registerAccount, sendOtp, verifyOtp, logout } = useAuth();

  const [activePortal, setActivePortal] = useState(
    roleParam && PORTALS.some((p) => p.key === roleParam) ? roleParam : "admin"
  );
  const [adminMethod, setAdminMethod] = useState("email");
  // Employee / Customer / Agent portals support the same two methods as
  // Super Admin (Email + Password, Mobile + OTP); default to Mobile OTP to
  // preserve the previous default experience for these portals.
  const [portalMethod, setPortalMethod] = useState("mobile");
  const [forgotOpen, setForgotOpen] = useState(false);

  // Login vs Create Account, scoped per portal tab. Never available for
  // Super Admin — see PUBLIC_REGISTRATION_ROLES on the backend, which
  // rejects "admin" outright.
  const [authMode, setAuthMode] = useState("login");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    if (roleParam && PORTALS.some((p) => p.key === roleParam)) {
      setActivePortal(roleParam);
    }
  }, [roleParam]);

  const portal = PORTALS.find((p) => p.key === activePortal);

  const selectPortal = (key) => {
    setActivePortal(key);
    setAuthMode("login");
  };

  const handleSuccess = (user) => {
    toast.success("Login successful. Welcome to NTAXCO ERP.");
    navigate(landingPath(user.role));
  };

  const handleRegisterSuccess = (email) => {
    setPrefillEmail(email);
    setPortalMethod("email");
    setAuthMode("login");
    setSuccessOpen(true);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* ===================== LEFT — BRAND PANEL ===================== */}
      <div className="relative flex flex-col justify-between p-8 sm:p-12 overflow-hidden bg-royal min-h-[280px] lg:min-h-screen">
        {/* subtle background shapes */}
        <div className="pointer-events-none absolute -top-28 -right-20 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative bg-white rounded-2xl px-5 py-4 w-fit shadow-lg"
        >
          <Logo className="h-14" />
        </motion.div>

        <div className="relative mt-10 lg:mt-0">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-[11px] font-semibold uppercase tracking-[0.25em] text-brand"
          >
            Professional Tax &amp; Business Consultancy
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="font-heading text-3xl sm:text-4xl xl:text-5xl font-black text-white leading-[1.1] mt-4 max-w-md tracking-tight"
          >
            Nizam&rsquo;s TaX Consultancy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.5 }}
            className="text-blue-100/90 mt-5 max-w-md leading-relaxed text-sm sm:text-base"
          >
            Manage taxation, compliance, clients, employees and business
            operations from one powerful ERP platform.
          </motion.p>

          <div className="grid grid-cols-2 gap-3 mt-8 max-w-md">
            {HIGHLIGHTS.map((h, i) => (
              <motion.div
                key={h.text}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 + i * 0.07, duration: 0.4 }}
                className="flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md px-3.5 py-3"
              >
                <h.icon className="h-4 w-4 text-brand shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-white">{h.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative hidden lg:flex items-center gap-2 text-blue-100/70 text-xs mt-10">
          <ShieldCheck className="h-4 w-4 text-brand" />
          Professional ERP Platform · © 2026 Nizam&rsquo;s Tax Consultancy
        </div>
      </div>

      {/* ===================== RIGHT — AUTH PANEL ===================== */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-md">
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Select your portal and sign in to continue.
          </p>

          {/* Portal segmented selector */}
          <div
            className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-slate-100 rounded-2xl"
            data-testid="portal-switcher"
          >
            {PORTALS.map((p) => {
              const active = p.key === activePortal;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => selectPortal(p.key)}
                  data-testid={`portal-tab-${p.key}`}
                  className="relative flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-colors focus:outline-none"
                >
                  {active && (
                    <motion.div
                      layoutId="portal-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 bg-brand rounded-xl shadow-md"
                    />
                  )}
                  <p.icon className={`relative z-10 h-4 w-4 ${active ? "text-zinc-900" : "text-slate-500"}`} />
                  <span className={`relative z-10 leading-tight text-center ${active ? "text-zinc-900" : "text-slate-600"}`}>
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePortal}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_8px_32px_rgba(30,64,175,0.08)] p-6">
                  <div className="flex items-center gap-2">
                    <portal.icon className="h-4 w-4 text-royal" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-royal">
                      Login as {portal.label}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500 mt-1.5">{portal.description}</p>

                  <div className="mt-5">
                    {activePortal === "admin" ? (
                      <>
                        <AdminLogin
                          method={adminMethod}
                          setMethod={setAdminMethod}
                          adminEmailLogin={adminEmailLogin}
                          sendOtp={sendOtp}
                          verifyOtp={verifyOtp}
                          onSuccess={handleSuccess}
                          onForgotPassword={() => setForgotOpen(true)}
                        />
                        <p className="mt-5 text-xs text-slate-400 text-center" data-testid="admin-registration-note">
                          Super Admin accounts are provisioned by the system administrator.
                        </p>
                      </>
                    ) : authMode === "register" ? (
                      <PortalRegisterForm
                        role={activePortal}
                        portalLabel={portal.label}
                        registerAccount={registerAccount}
                        logout={logout}
                        onSuccess={handleRegisterSuccess}
                        onBackToLogin={() => setAuthMode("login")}
                      />
                    ) : (
                      <>
                        <PortalLogin
                          role={activePortal}
                          method={portalMethod}
                          setMethod={setPortalMethod}
                          portalEmailLogin={portalEmailLogin}
                          sendOtp={sendOtp}
                          verifyOtp={verifyOtp}
                          onSuccess={handleSuccess}
                          onForgotPassword={() => setForgotOpen(true)}
                          defaultEmail={prefillEmail}
                        />
                        <p className="mt-5 text-sm text-slate-500 text-center">
                          Don&rsquo;t have an account?{" "}
                          <button
                            type="button"
                            onClick={() => setAuthMode("register")}
                            className="text-royal font-semibold hover:underline"
                            data-testid="create-account-link"
                          >
                            Create Account
                          </button>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent data-testid="forgot-password-modal">
          <DialogHeader>
            <DialogTitle>Forgot your password?</DialogTitle>
            <DialogDescription>
              Password recovery for NTAXCO ERP is handled by your system
              administrator. Please reach out to your Super Admin to have
              your password reset.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent data-testid="register-success-modal">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-center">Account Created Successfully</DialogTitle>
            <DialogDescription className="text-center">
              Your account has been created. Please login using your email and password.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => setSuccessOpen(false)}
            data-testid="continue-to-login-button"
            className="w-full bg-brand text-zinc-900 hover:bg-brand-hover font-bold h-11 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow,background-color]"
          >
            Continue to Login
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Super Admin login — Email + Password OR Mobile + Password
// ---------------------------------------------------------------------------
function AdminLogin({ method, setMethod, adminEmailLogin, sendOtp, verifyOtp, onSuccess, onForgotPassword }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5" data-testid="admin-method-switcher">
        {[
          { key: "email", label: "Email", icon: Mail },
          { key: "mobile", label: "Mobile OTP", icon: Smartphone },
        ].map((m) => {
          const active = method === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              data-testid={`admin-method-${m.key}`}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                active ? "bg-white text-royal shadow-sm" : "text-slate-500"
              }`}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {method === "email" ? (
          <motion.div key="email" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.18 }}>
            <AdminEmailForm adminEmailLogin={adminEmailLogin} onSuccess={onSuccess} onForgotPassword={onForgotPassword} />
          </motion.div>
        ) : (
          <motion.div key="mobile" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}>
            {/* Super Admin Mobile OTP uses the same real Twilio send/verify
               flow as the other portals. The backend only allows this to
               succeed for a mobile number that already belongs to an
               existing Super Admin account. */}
            <MobileOtpLogin role="admin" sendOtp={sendOtp} verifyOtp={verifyOtp} onSuccess={onSuccess} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminEmailForm({ adminEmailLogin, onSuccess, onForgotPassword }) {
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("ntaxco_remembered_email"));
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: localStorage.getItem("ntaxco_remembered_email") || "", password: "" },
  });

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    const toastId = toast.loading("Signing in...");
    try {
      const user = await adminEmailLogin(email, password);
      if (rememberMe) localStorage.setItem("ntaxco_remembered_email", email.trim().toLowerCase());
      else localStorage.removeItem("ntaxco_remembered_email");
      toast.dismiss(toastId);
      onSuccess(user);
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="admin-email-form">
      <div>
        <Label className="text-sm font-medium text-slate-700">Email address</Label>
        <Input
          {...register("email")}
          data-testid="login-email-input"
          placeholder="yourname@example.com"
          className="mt-1.5 border-slate-300 focus-visible:ring-brand/50"
        />
        <p className="text-[11px] text-slate-400 mt-1">Use the email and password registered for your NTAXCO account.</p>
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-700">Password</Label>
          <button type="button" onClick={onForgotPassword} className="text-xs text-royal font-medium hover:underline" data-testid="forgot-password-link">
            Forgot Password?
          </button>
        </div>
        <div className="mt-1.5">
          <PasswordInput
            registration={register("password")}
            testId="login-password-input"
            error={errors.password?.message}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="remember-me-email" checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} data-testid="remember-me-checkbox" />
        <Label htmlFor="remember-me-email" className="text-sm text-slate-600 font-normal cursor-pointer">Remember Me</Label>
      </div>
      <Button
        type="submit"
        disabled={loading}
        data-testid="login-submit-button"
        className="w-full bg-brand text-zinc-900 hover:bg-brand-hover font-bold h-11 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow,background-color]"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in...</> : "Login"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Employee / Customer / Agent — Email + Password OR Mobile + OTP
// (same login rules as Super Admin)
// ---------------------------------------------------------------------------
function PortalLogin({ role, method, setMethod, portalEmailLogin, sendOtp, verifyOtp, onSuccess, onForgotPassword, defaultEmail }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5" data-testid={`${role}-method-switcher`}>
        {[
          { key: "email", label: "Email", icon: Mail },
          { key: "mobile", label: "Mobile OTP", icon: Smartphone },
        ].map((m) => {
          const active = method === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              data-testid={`${role}-method-${m.key}`}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                active ? "bg-white text-royal shadow-sm" : "text-slate-500"
              }`}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {method === "email" ? (
          <motion.div key="email" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.18 }}>
            {/* key={defaultEmail} forces a remount (and so a fresh
               react-hook-form defaultValues read) whenever a just-registered
               email needs to be pre-filled — useForm only reads
               defaultValues once, on mount. */}
            <PortalEmailForm key={defaultEmail || "default"} role={role} portalEmailLogin={portalEmailLogin} onSuccess={onSuccess} onForgotPassword={onForgotPassword} defaultEmail={defaultEmail} />
          </motion.div>
        ) : (
          <motion.div key="mobile" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}>
            <MobileOtpLogin role={role} sendOtp={sendOtp} verifyOtp={verifyOtp} onSuccess={onSuccess} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PortalEmailForm({ role, portalEmailLogin, onSuccess, onForgotPassword, defaultEmail }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: defaultEmail || "", password: "" },
  });

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    const toastId = toast.loading("Signing in...");
    try {
      const user = await portalEmailLogin(role, email, password);
      toast.dismiss(toastId);
      onSuccess(user);
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid={`${role}-email-form`}>
      <div>
        <Label className="text-sm font-medium text-slate-700">Email address</Label>
        <Input
          {...register("email")}
          data-testid="login-email-input"
          placeholder="yourname@example.com"
          className="mt-1.5 border-slate-300 focus-visible:ring-brand/50"
        />
        <p className="text-[11px] text-slate-400 mt-1">Use the email and password registered for your NTAXCO account.</p>
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-700">Password</Label>
          <button type="button" onClick={onForgotPassword} className="text-xs text-royal font-medium hover:underline" data-testid="forgot-password-link">
            Forgot Password?
          </button>
        </div>
        <div className="mt-1.5">
          <PasswordInput
            registration={register("password")}
            testId="login-password-input"
            error={errors.password?.message}
          />
        </div>
      </div>
      <Button
        type="submit"
        disabled={loading}
        data-testid="login-submit-button"
        className="w-full bg-brand text-zinc-900 hover:bg-brand-hover font-bold h-11 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow,background-color]"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in...</> : "Login"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Employee / Customer / Agent — Mobile + OTP
// ---------------------------------------------------------------------------
const RESEND_COOLDOWN_SECONDS = 30;

function MobileOtpLogin({ role, sendOtp, verifyOtp, onSuccess }) {
  const [step, setStep] = useState("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(mobileOnlySchema),
    defaultValues: { mobile: "" },
  });
  const mobileReg = register("mobile");

  // Synchronous lock: `loading` state only updates on the next render, so a
  // fast double click / Enter + click could fire two requests. A ref closes
  // that gap so one click == one API call.
  const sendingRef = useRef(false);

  const requestOtp = async (mob) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setLoading(true);
    try {
      await sendOtp(mob, role);
      setMobile(mob);
      setStep("otp");
      setOtp("");
      setOtpError("");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(`OTP sent to +91 ${mob}`);
    } catch (e) {
      toast.error(e.message || "Failed to send OTP");
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const submitMobile = ({ mobile: mob }) => requestOtp(mob);

  const submitOtp = async () => {
    if (otp.length !== 6) {
      setOtpError("Please enter the 6-digit OTP.");
      return;
    }
    setLoading(true);
    setOtpError("");
    const toastId = toast.loading("Verifying OTP...");
    try {
      const user = await verifyOtp(mobile, otp, role);
      toast.dismiss(toastId);
      onSuccess(user);
    } catch (e) {
      toast.dismiss(toastId);
      const msg = e.message || "Invalid OTP. Please enter the correct 6-digit OTP.";
      setOtpError(msg);
      toast.error(msg);
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  if (step === "mobile") {
    return (
      <form onSubmit={handleSubmit(submitMobile)} className="space-y-4" data-testid={`${role}-mobile-form`}>
        <div>
          <Label className="text-sm font-medium text-slate-700">Mobile Number</Label>
          <Input
            {...mobileReg}
            onChange={(e) => {
              e.target.value = digitsOnly(e.target.value, 10);
              mobileReg.onChange(e);
              setValue("mobile", e.target.value, { shouldValidate: false });
            }}
            inputMode="numeric"
            maxLength={10}
            data-testid="login-mobile-input"
            placeholder="9876543210"
            className="mt-1.5 border-slate-300 focus-visible:ring-brand/50"
          />
          <p className="text-[11px] text-slate-400 mt-1">Any valid 10-digit Indian mobile number. An OTP will be sent via SMS.</p>
          {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile.message}</p>}
        </div>
        <Button
          type="submit"
          disabled={loading}
          data-testid="send-otp-button"
          className="w-full bg-brand text-zinc-900 hover:bg-brand-hover font-bold h-11 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow,background-color]"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending OTP...</> : <><Smartphone className="h-4 w-4 mr-2" />Send OTP</>}
        </Button>
      </form>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5" data-testid={`${role}-otp-form`}>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <KeyRound className="h-4 w-4 text-royal" />
        <span>OTP sent to <b className="text-zinc-900">+91 {mobile}</b></span>
        <button onClick={() => setStep("mobile")} className="text-royal font-medium ml-auto text-xs hover:underline" data-testid="change-mobile-link">
          Change
        </button>
      </div>
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={otp} onChange={(v) => { setOtp(v); setOtpError(""); }} data-testid="otp-input" autoFocus>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} className="h-12 w-10 text-lg border-slate-300" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {otpError && <p className="text-xs text-red-500 text-center">{otpError}</p>}
      <Button
        onClick={submitOtp}
        disabled={loading || otp.length !== 6}
        data-testid="verify-otp-button"
        className="w-full bg-brand text-zinc-900 hover:bg-brand-hover font-bold h-11 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow,background-color]"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying OTP...</> : "Verify OTP"}
      </Button>
      <button
        type="button"
        onClick={() => requestOtp(mobile)}
        disabled={loading || resendCooldown > 0}
        data-testid="resend-otp-button"
        className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-zinc-900 disabled:opacity-40"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {resendCooldown > 0
          ? `Resend available in ${resendCooldown}s`
          : "Didn\u2019t receive OTP? Resend"}
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Employee / Customer / Agent — Create Account
//
// Calls the SAME registerAccount() from AuthContext that already talks to
// the real POST /api/auth/register backend endpoint from Part 1 (see
// AuthContext.jsx) — no mock auth, no localStorage-only accounts. That
// endpoint auto-issues a JWT and logs the new account in as a side effect
// (see server.py's register() -> auth_response()); per the required UX
// here (success screen -> back to Login -> re-enter the same credentials),
// that just-issued session is cleared with the existing logout() right
// after a successful registration, rather than silently bypassing the
// login screen.
// ---------------------------------------------------------------------------
function PortalRegisterForm({ role, portalLabel, registerAccount, logout, onSuccess, onBackToLogin }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", email: "", mobile: "", password: "", confirmPassword: "" },
  });
  const mobileReg = register("mobile");

  const onSubmit = async ({ full_name, email, mobile, password }) => {
    setLoading(true);
    const toastId = toast.loading("Creating account...");
    try {
      await registerAccount({
        full_name,
        email,
        password,
        mobile: mobile || undefined,
        role,
      });

      try {
        await logout();
      } catch (_e) {
        // Best-effort session cleanup — even if it fails, the login form
        // below issues a fresh login on submit regardless.
      }

      toast.dismiss(toastId);
      onSuccess(email.trim().toLowerCase());
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid={`${role}-register-form`}>
      <div>
        <Label className="text-sm font-medium text-slate-700">Full Name</Label>
        <Input
          {...register("full_name")}
          data-testid="register-fullname-input"
          placeholder="Your full name"
          className="mt-1.5 border-slate-300 focus-visible:ring-brand/50"
        />
        {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">Email Address</Label>
        <Input
          {...register("email")}
          data-testid="register-email-input"
          placeholder="yourname@example.com"
          className="mt-1.5 border-slate-300 focus-visible:ring-brand/50"
        />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">
          Mobile Number <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <Input
          {...mobileReg}
          onChange={(e) => {
            e.target.value = digitsOnly(e.target.value, 10);
            mobileReg.onChange(e);
            setValue("mobile", e.target.value, { shouldValidate: false });
          }}
          inputMode="numeric"
          maxLength={10}
          data-testid="register-mobile-input"
          placeholder="9876543210"
          className="mt-1.5 border-slate-300 focus-visible:ring-brand/50"
        />
        {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile.message}</p>}
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">Password</Label>
        <div className="mt-1.5">
          <PasswordInput
            registration={register("password")}
            testId="register-password-input"
            error={errors.password?.message}
          />
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">Confirm Password</Label>
        <div className="mt-1.5">
          <PasswordInput
            registration={register("confirmPassword")}
            testId="register-confirm-password-input"
            error={errors.confirmPassword?.message}
          />
        </div>
      </div>
      <Button
        type="submit"
        disabled={loading}
        data-testid="register-submit-button"
        className="w-full bg-brand text-zinc-900 hover:bg-brand-hover font-bold h-11 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow,background-color]"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating Account...</>
        ) : (
          <><UserPlus className="h-4 w-4 mr-2" />Create {portalLabel} Account</>
        )}
      </Button>
      <button
        type="button"
        onClick={onBackToLogin}
        data-testid="back-to-login-link"
        className="w-full text-center text-sm text-royal font-medium hover:underline"
      >
        Back to Login
      </button>
    </form>
  );
}
