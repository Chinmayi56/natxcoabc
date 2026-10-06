export function notifyDataChanged(resources = [], source = null) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ntaxco:data-changed", {
      detail: { resources: [...new Set(resources)], source, timestamp: Date.now() },
    }));
  }
}
