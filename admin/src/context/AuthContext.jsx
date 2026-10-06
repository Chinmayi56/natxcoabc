import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import api, { formatApiError, describeApiError, isNetworkError, isTimeoutError } from "@/lib/api";
import {
  OTP_DEFAULT_COOLDOWN_SECONDS, otpSendInFlight, otpCooldownUntil,
  otpCooldownRemaining, otpCooldownError, otpRetryAfterSeconds,
} from "@/lib/otpGuard";

const AuthContext = createContext(null);

// Any valid email address is accepted (not restricted to a single
// provider). Kept as a simple, permissive RFC5322-ish check since the
// backend already validates strictly via Pydantic's EmailStr.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email || "").trim());
}

// Kept for backward compatibility with existing imports — now validates
// ANY valid email address rather than only @gmail.com addresses.
export function isValidGmail(email) {
  return isValidEmail(email);
}

export function isValidIndianMobile(mobile) {
  return INDIAN_MOBILE_REGEX.test(String(mobile || "").trim());
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ============================================================
  // LOAD CURRENT USER FROM REAL BACKEND
  // ============================================================
  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("ntaxco_access_token");

    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/auth/me");

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Unable to load current user."
        );
      }

      const currentUser = response.data.data;

      setUser(currentUser);

      localStorage.setItem(
        "ntaxco_user",
        JSON.stringify(currentUser)
      );

      localStorage.setItem(
        "ntaxco_auth_mode",
        "backend"
      );
    } catch (error) {
      console.error(
        "LOAD USER ERROR:",
        error.response?.data || error.message
      );

      // A temporary backend/network outage must NOT log the user out.
      // Keep the last known user so the portal remains stable and the API
      // client can report the real connection problem instead of bouncing
      // the user back to the login screen. A genuine 401 still clears the
      // session through the API interceptor.
      if (isNetworkError(error) || isTimeoutError(error) || (error.response?.status >= 500)) {
        const cached = localStorage.getItem("ntaxco_user");
        if (cached) {
          try {
            setUser(JSON.parse(cached));
            return;
          } catch {
            // Ignore malformed cached data and fall through to a clean session.
          }
        }
      }

      localStorage.removeItem("ntaxco_access_token");
      localStorage.removeItem("ntaxco_refresh_token");
      localStorage.removeItem("ntaxco_user");
      localStorage.removeItem("ntaxco_auth_mode");

      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // ============================================================
  // SUPER ADMIN - EMAIL LOGIN
  // REAL BACKEND JWT LOGIN
  // ============================================================
  const adminEmailLogin = useCallback(async (email, password) => {
    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!isValidGmail(cleanEmail)) {
      throw new Error("Please enter a valid Gmail address.");
    }

    if (!String(password || "").trim()) {
      throw new Error("Please enter your password.");
    }

    try {
      const response = await api.post(
        "/auth/admin/login",
        {
          email: cleanEmail,
          password: String(password),
        }
      );

      const result = response.data;

      if (
        !result?.success ||
        !result?.data?.access_token
      ) {
        throw new Error(
          result?.message || "Login failed."
        );
      }

      const {
        access_token,
        refresh_token,
        user,
      } = result.data;

      // Store REAL JWT
      localStorage.setItem(
        "ntaxco_access_token",
        access_token
      );

      if (refresh_token) {
        localStorage.setItem(
          "ntaxco_refresh_token",
          refresh_token
        );
      }

      if (user) {
        localStorage.setItem(
          "ntaxco_user",
          JSON.stringify(user)
        );

        setUser(user);
      }

      localStorage.setItem(
        "ntaxco_auth_mode",
        "backend"
      );

      return user;
    } catch (error) {
      console.error(
        "ADMIN EMAIL LOGIN ERROR:",
        error.response?.data || error.message
      );

      // Route through the centralized error mapper (not just
      // formatApiError on the raw detail) so a dead connection, a
      // timeout, or a bare-status response from a proxy never leaks a
      // raw Axios/"Network Error" string to the user.
      throw new Error(describeApiError(error, "Login failed."));
    }
  }, []);

  // ============================================================
  // EMPLOYEE / CUSTOMER / AGENT - EMAIL LOGIN
  //
  // Same rule as Super Admin's email login: any valid email address
  // with the configured account password. Kept as a separate function (rather
  // than reusing adminEmailLogin) so the Super Admin flow above stays
  // completely untouched.
  // ============================================================
  const portalEmailLogin = useCallback(async (role, email, password) => {
    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      throw new Error("Please enter a valid email address.");
    }

    if (!String(password || "").trim()) {
      throw new Error("Please enter your password.");
    }

    try {
      const response = await api.post(
        "/auth/portal/login",
        {
          email: cleanEmail,
          password: String(password),
          role,
        }
      );

      const result = response.data;

      if (
        !result?.success ||
        !result?.data?.access_token
      ) {
        throw new Error(
          result?.message || "Login failed."
        );
      }

      const {
        access_token,
        refresh_token,
        user,
      } = result.data;

      localStorage.setItem(
        "ntaxco_access_token",
        access_token
      );

      if (refresh_token) {
        localStorage.setItem(
          "ntaxco_refresh_token",
          refresh_token
        );
      }

      if (user) {
        localStorage.setItem(
          "ntaxco_user",
          JSON.stringify(user)
        );

        setUser(user);
      }

      localStorage.setItem(
        "ntaxco_auth_mode",
        "backend"
      );

      return user;
    } catch (error) {
      console.error(
        "PORTAL EMAIL LOGIN ERROR:",
        error.response?.data || error.message
      );

      throw new Error(describeApiError(error, "Login failed."));
    }
  }, []);

  // ============================================================
  // CREATE ACCOUNT — REAL EMAIL + PASSWORD REGISTRATION
  // Employee / Customer / Agent only (backend rejects "admin").
  // Not wired into any UI yet — exposed here so a future
  // registration screen can call it. Logs the new account in on
  // success, same as the other auth methods above.
  // ============================================================
  const registerAccount = useCallback(async (userData) => {
    const {
      full_name,
      email,
      password,
      role,
      mobile,
    } = userData || {};

    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();
    const cleanFullName = String(full_name || "").trim();

    if (!cleanFullName) {
      throw new Error("Please enter your full name.");
    }

    if (!isValidEmail(cleanEmail)) {
      throw new Error("Please enter a valid email address.");
    }

    if (String(password || "").length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    if (mobile && !isValidIndianMobile(mobile)) {
      throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }

    try {
      const response = await api.post(
        "/auth/register",
        {
          full_name: cleanFullName,
          email: cleanEmail,
          password: String(password),
          role,
          mobile: mobile || undefined,
        }
      );

      const result = response.data;

      if (
        !result?.success ||
        !result?.data?.access_token
      ) {
        throw new Error(
          result?.message || "Registration failed."
        );
      }

      const {
        access_token,
        refresh_token,
        user,
      } = result.data;

      localStorage.setItem(
        "ntaxco_access_token",
        access_token
      );

      if (refresh_token) {
        localStorage.setItem(
          "ntaxco_refresh_token",
          refresh_token
        );
      }

      if (user) {
        localStorage.setItem(
          "ntaxco_user",
          JSON.stringify(user)
        );

        setUser(user);
      }

      localStorage.setItem(
        "ntaxco_auth_mode",
        "backend"
      );

      return user;
    } catch (error) {
      console.error(
        "REGISTER ACCOUNT ERROR:",
        error.response?.data || error.message
      );

      throw new Error(describeApiError(error, "Registration failed."));
    }
  }, []);

  // ============================================================
  // SEND OTP
  // Employee / Customer / Agent / Super Admin mobile
  // ============================================================
  const sendOtp = useCallback(async (mobile, role) => {
    const cleanMobile = String(mobile || "").trim();

    if (!isValidIndianMobile(cleanMobile)) {
      throw new Error(
        "Please enter a valid 10-digit Indian mobile number."
      );
    }

    // One click -> one request. A second call for the same number/role while
    // the first is still in flight (double click / Enter + click) shares it.
    const key = `${role}:${cleanMobile}`;
    const pending = otpSendInFlight.get(key);
    if (pending) return pending;

    // Respect the cooldown locally so we never ask the server for an OTP it
    // has already told us to wait for.
    const wait = otpCooldownRemaining(key);
    if (wait > 0) throw otpCooldownError(wait);

    const request = (async () => {
      try {
        const response = await api.post(
          "/auth/mobile/send-otp",
          {
            mobile: cleanMobile,
            role,
          }
        );
        const cooldown = Number(response.data?.data?.cooldown_seconds) || OTP_DEFAULT_COOLDOWN_SECONDS;
        otpCooldownUntil.set(key, Date.now() + cooldown * 1000);
        return response.data;
      } catch (error) {
        console.error(
          "SEND OTP ERROR:",
          error.response?.data || error.message
        );
        const retryAfter = otpRetryAfterSeconds(error);
        if (retryAfter > 0) otpCooldownUntil.set(key, Date.now() + retryAfter * 1000);
        const err = new Error(describeApiError(error, "Unable to send OTP."));
        if (retryAfter > 0) err.retryAfter = retryAfter;
        throw err;
      } finally {
        otpSendInFlight.delete(key);
      }
    })();
    otpSendInFlight.set(key, request);
    return request;
  }, []);

  // ============================================================
  // VERIFY OTP
  // ============================================================
  const verifyOtp = useCallback(
    async (mobile, otp, role) => {
      const cleanMobile = String(mobile || "").trim();
      const cleanOtp = String(otp || "").trim();

      if (!isValidIndianMobile(cleanMobile)) {
        throw new Error(
          "Please enter a valid 10-digit Indian mobile number."
        );
      }

      if (!cleanOtp) {
        throw new Error("Please enter the OTP.");
      }

      try {
        const response = await api.post(
          "/auth/mobile/verify-otp",
          {
            mobile: cleanMobile,
            otp: cleanOtp,
            role,
          }
        );

        const result = response.data;

        if (
          !result?.success ||
          !result?.data?.access_token
        ) {
          throw new Error(
            result?.message || "OTP verification failed."
          );
        }

        const {
          access_token,
          refresh_token,
          user,
        } = result.data;

        // Store REAL JWT
        localStorage.setItem(
          "ntaxco_access_token",
          access_token
        );

        if (refresh_token) {
          localStorage.setItem(
            "ntaxco_refresh_token",
            refresh_token
          );
        }

        if (user) {
          localStorage.setItem(
            "ntaxco_user",
            JSON.stringify(user)
          );

          setUser(user);
        }

        localStorage.setItem(
          "ntaxco_auth_mode",
          "backend"
        );

        return user;
      } catch (error) {
        console.error(
          "VERIFY OTP ERROR:",
          error.response?.data || error.message
        );

        throw new Error(describeApiError(error, "OTP verification failed."));
      }
    },
    []
  );

  // ============================================================
  // LOGOUT
  // ============================================================
  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem(
        "ntaxco_access_token"
      );

      if (token) {
        await api.post("/auth/logout");
      }
    } catch (error) {
      console.warn(
        "Logout API error:",
        error.response?.data || error.message
      );
    } finally {
      localStorage.removeItem("ntaxco_access_token");
      localStorage.removeItem("ntaxco_refresh_token");
      localStorage.removeItem("ntaxco_user");
      localStorage.removeItem("ntaxco_auth_mode");

      setUser(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
  user,
  loading,
  adminEmailLogin,
  portalEmailLogin,
  registerAccount,
  sendOtp,
  verifyOtp,
  logout,
  formatApiError,
}}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return ctx;
}

