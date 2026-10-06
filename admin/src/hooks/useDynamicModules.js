import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

// Fired by SettingsPage after a module is created/updated/deleted so the
// sidebar can pick up the change immediately, without waiting for a route
// change or a manual refresh.
export const DYNAMIC_MODULES_CHANGED_EVENT = "ntaxco:dynamic-modules-changed";

export function notifyDynamicModulesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DYNAMIC_MODULES_CHANGED_EVENT));
  }
}

// Loads the admin's enabled dynamic modules so the sidebar (and other UI)
// can reflect them without any hard-coded module list. Refetches on mount,
// whenever the dynamic-modules-changed event fires, and whenever
// `refreshKey` changes (pass the current route pathname for a cheap
// fallback in case the event was missed).
export function useDynamicModules(enabled, refreshKey) {
  const [modules, setModules] = useState([]);

  const load = useCallback(() => {
    if (!enabled) { setModules([]); return; }
    api.get("/admin/dynamic-config")
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setModules(rows.filter((m) => m?.enabled !== false && m?.key));
      })
      .catch(() => setModules([]));
  }, [enabled]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener(DYNAMIC_MODULES_CHANGED_EVENT, load);
    return () => window.removeEventListener(DYNAMIC_MODULES_CHANGED_EVENT, load);
  }, [enabled, load]);

  return modules;
}
