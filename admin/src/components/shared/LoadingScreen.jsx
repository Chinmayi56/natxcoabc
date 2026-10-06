import { LOGO_URL } from "@/lib/constants";

export default function LoadingScreen({ label = "Loading NTAXCO ERP..." }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0A2540] gap-7 relative overflow-hidden" data-testid="loading-screen">
      <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-[#FFB800]/15 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#1E3A8A]/40 blur-3xl" />
      <div className="relative bg-white rounded-2xl px-7 py-5 shadow-2xl animate-pulse">
        <img src={LOGO_URL} alt="NTAXCO" className="h-16 w-auto object-contain" />
      </div>
      <div className="relative text-center">
        <p className="font-heading text-xl font-black text-white tracking-tight">NTAXCO ERP</p>
        <p className="text-xs text-slate-300 mt-1 uppercase tracking-[0.2em]">Enterprise Tax & Consultancy Platform</p>
      </div>
      <div className="relative w-52 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-[#FFB800] rounded-full animate-[loading-bar_1.2s_ease-in-out_infinite]" />
      </div>
      <span className="relative text-sm text-slate-300">{label}</span>
      <style>{`@keyframes loading-bar{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  );
}
