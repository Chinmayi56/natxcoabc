// Global helper to open the floating AI Tax Copilot from anywhere in the app.
export const openCopilot = (prompt) =>
  window.dispatchEvent(new CustomEvent("ntaxco:open-copilot", { detail: { prompt } }));
