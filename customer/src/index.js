import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import AppErrorBoundary from "@/components/shared/AppErrorBoundary";

// This app intentionally has no service worker. If this origin
// (host + port, e.g. a LAN IP:port that was previously used to serve a
// different Vite/PWA app) has a stale service worker left over from that
// other app, it can keep intercepting requests here and serving that
// other app's cached assets instead of NTAXCO's — a browser storage
// issue, not a bug in this app. Proactively unregister/clear it so this
// origin always loads the current build.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((r) => r.unregister()))
    .catch(() => {});
  if (window.caches && caches.keys) {
    caches
      .keys()
      .then((keys) => keys.forEach((key) => caches.delete(key)))
      .catch(() => {});
  }
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60000, refetchOnWindowFocus: false } } });
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><QueryClientProvider client={queryClient}><AppErrorBoundary><App /></AppErrorBoundary></QueryClientProvider></React.StrictMode>);
