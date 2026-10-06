import axios from "axios";

// Resolve the API once at startup. The frontend can run on localhost, a LAN
// address (for example 192.168.x.x), or a deployed domain. A literal
// localhost API URL is automatically changed to the browser's host when the
// app is opened from another device on the LAN.
const rawConfiguredApiUrl = String(process.env.REACT_APP_API_URL || "").trim().replace(/\/+$/, "");
const isProdBuild = process.env.NODE_ENV === "production";

function resolveApiUrl() {
  // Local development uses the existing React dev-server proxy. This keeps
  // browser requests same-origin (/api/...) while the proxy forwards them to
  // the existing FastAPI service on port 8001.
  if (rawConfiguredApiUrl.startsWith("/")) {
    return rawConfiguredApiUrl.replace(/\/+$/, "");
  }

  if (rawConfiguredApiUrl) {
    return rawConfiguredApiUrl;
  }

  // Preserve production support without hardcoding localhost into deployed
  // builds. The normal local configuration is supplied by .env as /api.
  return isProdBuild ? "/api" : "/api";
}

const API = resolveApiUrl();
console.info("[NTAXCO] API base URL:", API);

const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("ntaxco_access_token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[NTAXCO API ERROR]", {
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem("ntaxco_access_token");
      localStorage.removeItem("ntaxco_access_token");
      localStorage.removeItem("ntaxco_refresh_token");
      localStorage.removeItem("ntaxco_user");
      localStorage.removeItem("ntaxco_auth_mode");
      if (hadToken && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(detail) {
  if (!detail) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((x) => x?.msg || JSON.stringify(x)).join(", ");
  return detail?.message || "Something went wrong.";
}

const STATUS_FALLBACK_MESSAGES = {
  400: "Please check the information you entered and try again.",
  401: "Invalid email or password.",
  403: "You don't have permission to access this portal.",
  404: "The requested service could not be found. Please try again later.",
  409: "An account with this email already exists. Please login instead.",
  422: "Please correct the highlighted information.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Something went wrong on the server. Please try again later.",
  502: "Unable to reach the authentication service right now. Please try again.",
  503: "The authentication service is temporarily unavailable. Please try again.",
  504: "The server took too long to respond. Please try again.",
};

export function describeApiError(error, fallback) {
  if (!error) return fallback || "Something went wrong. Please try again.";
  const isTimeout = error.code === "ECONNABORTED" || /timeout/i.test(String(error.message || ""));
  if (isTimeout) return "The NTAXCO backend took too long to respond. Please make sure the backend and database are running, then try again.";
  if (!error.response) {
    if (error.code === "ERR_NETWORK" || /network|failed to fetch|connection refused|cors|unable to connect/i.test(String(error.message || ""))) {
      return `Unable to connect to the NTAXCO backend. Start the FastAPI backend on port 8001 and verify the /api proxy, or set REACT_APP_API_URL to the deployed backend /api URL.`;
    }
    return "Unable to connect to the NTAXCO server. Please check the backend and your network connection.";
  }
  const status = error.response.status;
  const detail = error.response.data?.detail ?? error.response.data?.message;
  if (detail) return formatApiError(detail);
  return STATUS_FALLBACK_MESSAGES[status] || fallback || error.message || "Something went wrong.";
}

export function isNetworkError(error) {
  if (!error) return false;
  const isTimeout = error.code === "ECONNABORTED" || /timeout/i.test(String(error.message || ""));
  return !isTimeout && !error.response;
}

export function isTimeoutError(error) {
  if (!error) return false;
  return error.code === "ECONNABORTED" || /timeout/i.test(String(error.message || ""));
}

export { API };
export default api;
