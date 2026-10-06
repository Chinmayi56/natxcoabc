import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import PageHeader from "@/components/shared/PageHeader";
import { ROLES } from "@/lib/constants";
import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ModulePlaceholder({ role, title }) {
  const location = useLocation();
  const derived = title || location.pathname.split("/").pop().replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div>
      <PageHeader title={derived} breadcrumb={[ROLES[role].label, derived]} subtitle={`${derived} module — connected to the shared NTAXCO backend.`} />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-zinc-200 rounded-xl shadow-sm p-12 text-center">
        <div className="h-16 w-16 rounded-2xl bg-brand-faint flex items-center justify-center mx-auto mb-5">
          <Hammer className="h-7 w-7 text-brand-hover" />
        </div>
        <h2 className="font-heading text-xl font-bold text-zinc-900">{derived} is being built</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          The architecture, routing, and shared UI system for this module are ready. Full CRUD, tables, filters and exports for <b>{derived}</b> will be implemented in the next phase.
        </p>
        <Button className="mt-6 bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={() => toast.info(`${derived}: this module is not configured yet.`)} data-testid="placeholder-action">
          Preview action
        </Button>
      </motion.div>
    </div>
  );
}
