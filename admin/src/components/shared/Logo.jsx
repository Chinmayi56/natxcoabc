import { LOGO_URL } from "@/lib/constants";

export default function Logo({ className = "h-10", showText = false }) {
  return (
    <div className="flex items-center gap-2" data-testid="ntaxco-logo">
      <img
        src={LOGO_URL}
        alt="NTAXCO - Nizam's Tax Consultancy"
        className={`${className} w-auto object-contain`}
      />
    </div>
  );
}