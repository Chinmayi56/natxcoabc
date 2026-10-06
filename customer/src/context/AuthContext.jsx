import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { describeApiError, isNetworkError, isTimeoutError } from "@/lib/api";
import {
  OTP_DEFAULT_COOLDOWN_SECONDS, otpSendInFlight, otpCooldownUntil,
  otpCooldownRemaining, otpCooldownError, otpRetryAfterSeconds,
} from "@/lib/otpGuard";

const AuthContext = createContext(null);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;

export const isValidEmail = (email) => EMAIL_REGEX.test(String(email || "").trim());
export const isValidIndianMobile = (mobile) => MOBILE_REGEX.test(String(mobile || "").trim());

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem("ntaxco_access_token");
    localStorage.removeItem("ntaxco_refresh_token");
    localStorage.removeItem("ntaxco_user");
    localStorage.removeItem("ntaxco_auth_mode");
    setUser(false);
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("ntaxco_access_token");
    if (!token) { setUser(false); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      const current = data?.data;
      if (!data?.success || !current) throw new Error(data?.message || "Unable to load current user.");
      if (current.role !== "customer") throw new Error("This account is not authorized for the Customer Portal.");
      localStorage.setItem("ntaxco_user", JSON.stringify(current));
      localStorage.setItem("ntaxco_auth_mode", "backend");
      setUser(current);
    } catch (error) {
      console.error("CUSTOMER SESSION ERROR:", error.response?.data || error.message);
      // Keep the cached customer session during a temporary network/server
      // outage. Only a real authentication failure (401) should force a
      // logout; the API interceptor already clears those tokens.
      if (isNetworkError(error) || isTimeoutError(error) || (error.response?.status >= 500)) {
        const cached = localStorage.getItem("ntaxco_user");
        if (cached) {
          try {
            setUser(JSON.parse(cached));
            return;
          } catch {
            // Fall through to clean the session if cached data is invalid.
          }
        }
      }
      clearSession();
    } finally { setLoading(false); }
  }, [clearSession]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = useCallback(async (email, password) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) throw new Error("Please enter a valid email address.");
    if (!String(password || "").trim()) throw new Error("Please enter your password.");
    try {
      const { data } = await api.post("/auth/portal/login", { email: cleanEmail, password: String(password), role: "customer" });
      if (!data?.success || !data?.data?.access_token) throw new Error(data?.message || "Login failed.");
      const { access_token, refresh_token, user: loggedUser } = data.data;
      if (loggedUser?.role !== "customer") throw new Error("This account is not a customer account.");
      localStorage.setItem("ntaxco_access_token", access_token);
      if (refresh_token) localStorage.setItem("ntaxco_refresh_token", refresh_token);
      localStorage.setItem("ntaxco_user", JSON.stringify(loggedUser));
      localStorage.setItem("ntaxco_auth_mode", "backend");
      setUser(loggedUser);
      return loggedUser;
    } catch (error) {
      console.error("CUSTOMER LOGIN ERROR:", error.response?.data || error.message);
      throw new Error(describeApiError(error, "Login failed."));
    }
  }, []);

  const sendOtp = useCallback(async (mobile) => {
    const clean = String(mobile || "").trim();
    if (!isValidIndianMobile(clean)) throw new Error("Please enter a valid 10-digit Indian mobile number.");

    // One click -> one request. A second call for the same number while the
    // first is still in flight (double click / Enter + click) shares it.
    const pending = otpSendInFlight.get(clean);
    if (pending) return pending;

    // Respect the cooldown locally so we never ask the server for an OTP it
    // has already told us to wait for.
    const wait = otpCooldownRemaining(clean);
    if (wait > 0) throw otpCooldownError(wait);

    const request = (async () => {
      try {
        const { data } = await api.post("/auth/mobile/send-otp", { mobile: clean, role: "customer" });
        otpCooldownUntil.set(clean, Date.now() + (Number(data?.data?.cooldown_seconds) || OTP_DEFAULT_COOLDOWN_SECONDS) * 1000);
        return data;
      } catch (error) {
        const retryAfter = otpRetryAfterSeconds(error);
        if (retryAfter > 0) otpCooldownUntil.set(clean, Date.now() + retryAfter * 1000);
        const err = new Error(describeApiError(error, "Unable to send OTP."));
        if (retryAfter > 0) err.retryAfter = retryAfter;
        throw err;
      } finally {
        otpSendInFlight.delete(clean);
      }
    })();
    otpSendInFlight.set(clean, request);
    return request;
  }, []);

  const verifyOtp = useCallback(async (mobile, otp) => {
    const clean = String(mobile || "").trim();
    if (!isValidIndianMobile(clean)) throw new Error("Please enter a valid 10-digit Indian mobile number.");
    if (!String(otp || "").trim()) throw new Error("Please enter the OTP.");
    try {
      const { data } = await api.post("/auth/mobile/verify-otp", { mobile: clean, otp: String(otp).trim(), role: "customer" });
      if (!data?.success || !data?.data?.access_token) throw new Error(data?.message || "OTP verification failed.");
      const { access_token, refresh_token, user: loggedUser } = data.data;
      if (loggedUser?.role !== "customer") throw new Error("This account is not a customer account.");
      localStorage.setItem("ntaxco_access_token", access_token);
      if (refresh_token) localStorage.setItem("ntaxco_refresh_token", refresh_token);
      localStorage.setItem("ntaxco_user", JSON.stringify(loggedUser));
      localStorage.setItem("ntaxco_auth_mode", "backend");
      setUser(loggedUser);
      return loggedUser;
    } catch (error) { throw new Error(describeApiError(error, "OTP verification failed.")); }
  }, []);


  const register = useCallback(async (fullName, email, mobile, password) => {
    const cleanName = String(fullName || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanMobile = String(mobile || "").trim();
    if (!cleanName) throw new Error("Please enter your name.");
    if (!isValidEmail(cleanEmail)) throw new Error("Please enter a valid email address.");
    if (!isValidIndianMobile(cleanMobile)) throw new Error("Please enter a valid 10-digit Indian mobile number.");
    if (String(password || "").length < 8) throw new Error("Password must be at least 8 characters long.");
    try {
      const { data } = await api.post("/auth/register", {
        full_name: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        password: String(password),
        role: "customer",
      });
      if (!data?.success || !data?.data?.access_token) throw new Error(data?.message || "Registration failed.");
      const { access_token, refresh_token, user: registeredUser } = data.data;
      if (registeredUser?.role !== "customer") throw new Error("Registration did not create a customer account.");
      localStorage.setItem("ntaxco_access_token", access_token);
      if (refresh_token) localStorage.setItem("ntaxco_refresh_token", refresh_token);
      localStorage.setItem("ntaxco_user", JSON.stringify(registeredUser));
      localStorage.setItem("ntaxco_auth_mode", "backend");
      setUser(registeredUser);
      return registeredUser;
    } catch (error) {
      console.error("CUSTOMER REGISTRATION ERROR:", error.response?.data || error.message);
      throw new Error(describeApiError(error, "Unable to create your customer account."));
    }
  }, []);

  const logout = useCallback(async () => {
    try { if (localStorage.getItem("ntaxco_access_token")) await api.post("/auth/logout"); } catch (e) { console.warn("Customer logout API error:", e.response?.data || e.message); }
    clearSession();
  }, [clearSession]);

  return <AuthContext.Provider value={{ user, loading, login, register, sendOtp, verifyOtp, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
