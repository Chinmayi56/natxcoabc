import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import api, { describeApiError } from "@/lib/api";
import CrudModule from "@/components/shared/CrudModule";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Boxes, Settings } from "lucide-react";

// Renders ANY admin-created "Modules / Dynamic Configuration" module —
// nothing here is hard-coded to a specific module. The module's fields,
// labels and options are all read from its saved configuration, and the
// generated table/form/record CRUD is powered by the generic
// /dynamic-records/{module_key} backend API via CrudModule.
export default function DynamicModulePage() {
  const { moduleSlug } = useParams();
  const [status, setStatus] = useState("loading"); // loading | found | missing | error
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    api.get("/admin/dynamic-config")
      .then(({ data }) => {
        if (!alive) return;
        const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const match = rows.find((c) => c?.key === moduleSlug);
        if (match) { setConfig(match); setStatus("found"); }
        else setStatus("missing");
      })
      .catch((e) => {
        if (!alive) return;
        toast.error(describeApiError(e, "Unable to load this module"));
        setStatus("error");
      });
    return () => { alive = false; };
  }, [moduleSlug]);

  if (status === "loading") {
    return (
      <div>
        <PageHeader title="Loading module..." breadcrumb={["Super Admin", "Modules"]} />
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
    );
  }

  if (status === "missing" || status === "error") {
    return (
      <div>
        <PageHeader title="Module not found" breadcrumb={["Super Admin", "Modules"]} />
        <EmptyState
          icon={Boxes}
          title={status === "missing" ? "This module doesn't exist (yet)" : "Couldn't load this module"}
          description={
            status === "missing"
              ? "It may have been deleted, or the link is out of date. Create or manage modules from Settings → Modules / Dynamic Configuration."
              : "Something went wrong while loading this module. Please try again."
          }
          action={{ label: "Go to Settings", onClick: () => { window.location.href = "/admin/settings"; } }}
        />
      </div>
    );
  }

  if (config.enabled === false) {
    return (
      <div>
        <PageHeader title={config.name} breadcrumb={["Super Admin", config.name]} />
        <EmptyState
          icon={Settings}
          title={`${config.name} is disabled`}
          description="Enable this module from Settings → Modules / Dynamic Configuration to start adding records."
          action={{ label: "Go to Settings", onClick: () => { window.location.href = "/admin/settings"; } }}
        />
      </div>
    );
  }

  const configuredFields = Array.isArray(config.fields) ? config.fields : [];

  if (configuredFields.length === 0) {
    return (
      <div>
        <PageHeader title={config.name} breadcrumb={["Super Admin", config.name]} />
        <EmptyState
          icon={Boxes}
          title="No fields configured yet"
          description="Add at least one field to this module in Settings → Modules / Dynamic Configuration before adding records."
          action={{ label: "Go to Settings", onClick: () => { window.location.href = "/admin/settings"; } }}
        />
      </div>
    );
  }

  const fields = configuredFields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type, // text | textarea | number | select | date
    required: !!f.required,
    options: f.options || [],
    full: f.type === "textarea",
  }));

  const columns = configuredFields.map((f) => ({
    key: f.key,
    label: f.label,
    render: f.type === "textarea"
      ? (r) => {
          const v = String(r[f.key] ?? "");
          return v.length > 60 ? `${v.slice(0, 60)}…` : (v || "—");
        }
      : undefined,
  }));

  return (
    <CrudModule
      title={config.name}
      singular={config.name}
      name={`dynamic-records/${config.key}`}
      breadcrumb={["Super Admin", "Modules", config.name]}
      columns={columns}
      fields={fields}
    />
  );
}
