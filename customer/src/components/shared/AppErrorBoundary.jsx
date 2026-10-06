import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("[NTAXCO] Customer application error:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center bg-white p-6">
        <section className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-[#0A2540]">NTAXCO Customer Portal</h1>
          <p className="mt-3 text-sm text-zinc-600">
            The customer application encountered an unexpected error. Refresh the page to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-[#0A2540] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Refresh
          </button>
        </section>
      </main>
    );
  }
}
