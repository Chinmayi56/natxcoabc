import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";

// The customer website runs in its own browser context, so it cannot receive the admin app's
// in-page events. Lists are therefore re-read from the backend every `pollMs` (silently, only while
// the tab is visible) and whenever the tab regains focus, so a status the admin changes shows up
// here without a manual refresh. Set pollMs to 0 to disable.
export function useCrud(name, { pollMs = 15000 } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (opts) => {
    const silent = opts && opts.silent === true;
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(`/${name}`);
      setRows(data.data || []);
    } catch (e) {
      if (!silent) toast.error(formatApiError(e.response?.data?.detail) || `Failed to load ${name}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    load();
    if (!(pollMs > 0)) return undefined;
    const tick = () => { if (!document.hidden) load({ silent: true }); };
    const timer = window.setInterval(tick, pollMs);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [load, pollMs]);

  const create = async (body) => {
    await api.post(`/${name}`, body);
    toast.success("Record created");
    await load();
  };
  const update = async (id, body) => {
    await api.put(`/${name}/${id}`, body);
    toast.success("Record updated");
    await load();
  };
  const remove = async (id) => {
    await api.delete(`/${name}/${id}`);
    toast.success("Record deleted");
    await load();
  };

  return { rows, loading, load, create, update, remove };
}
