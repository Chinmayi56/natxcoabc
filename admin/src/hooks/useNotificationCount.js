import { useEffect, useState } from "react";
import api from "@/lib/api";

// One shared, lightweight poll for the unread-notification count (bell +
// sidebar badge). The count always comes from MongoDB via
// GET /api/notifications/unread-count — never from component state.
// It polls every POLL_MS, only while the tab is visible, and when a NEW
// notification appears it asks the Customers/Bookings views to reload, so a
// customer's new booking shows up in the Admin portal without a manual refresh.
const POLL_MS = 20000;
let state = { unread: 0, latestId: null, ready: false };
const listeners = new Set();
let timer = null;
let inFlight = false;

function emit() { listeners.forEach((fn) => fn(state)); }

export async function refreshNotificationCount() {
  if (inFlight || !localStorage.getItem("ntaxco_access_token")) return;
  inFlight = true;
  try {
    const { data } = await api.get("/notifications/unread-count");
    const next = { unread: data?.data?.unread ?? 0, latestId: data?.data?.latest_id ?? null, ready: true };
    const hasNew = state.ready && next.latestId && next.latestId !== state.latestId;
    const changed = next.unread !== state.unread || next.latestId !== state.latestId || !state.ready;
    state = next;
    if (changed) emit();
    if (hasNew) {
      window.dispatchEvent(new CustomEvent("ntaxco:data-changed", {
        detail: { source: "notifications", resources: ["notifications", "customers", "bookings"] },
      }));
    }
  } catch (e) { /* transient network/auth errors: keep the last known count */ }
  finally { inFlight = false; }
}

function start() {
  if (timer) return;
  refreshNotificationCount();
  timer = window.setInterval(() => { if (!document.hidden) refreshNotificationCount(); }, POLL_MS);
}
function stop() { if (timer && listeners.size === 0) { window.clearInterval(timer); timer = null; } }

export function useNotificationCount() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    start();
    const onVisible = () => { if (!document.hidden) refreshNotificationCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { listeners.delete(setS); document.removeEventListener("visibilitychange", onVisible); stop(); };
  }, []);
  return s.unread;
}
