import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api, { describeApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  Building2, Palette, Mail, Bot, Calculator, Receipt, Users, ShieldCheck, BellRing, Server, Save, SlidersHorizontal, Plus, Trash2, RefreshCw, Pencil, ExternalLink, X as XIcon, Image as ImageIcon, UploadCloud,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notifyDynamicModulesChanged } from "@/hooks/useDynamicModules";

const TABS = [
  { key: "company", label: "Company", icon: Building2 },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "comms", label: "Communications", icon: Mail },
  { key: "ai", label: "AI Copilot", icon: Bot },
  { key: "tax", label: "Tax & GST", icon: Calculator },
  { key: "invoice", label: "Invoice & Payroll", icon: Receipt },
  { key: "roles", label: "Users & Roles", icon: Users },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "notif", label: "Notifications", icon: BellRing },
  { key: "images", label: "Images", icon: ImageIcon },
  { key: "system", label: "System", icon: Server },
  { key: "dynamic", label: "Modules / Dynamic Configuration", icon: SlidersHorizontal },
];

// Where an uploaded image can appear on the customer site.
const IMAGE_PLACEMENTS = [
  { value: "home", label: "Home" },
  { value: "dashboard", label: "Dashboard" },
  { value: "projects", label: "Projects" },
  { value: "services", label: "Services" },
];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — matches the backend's accepted upload size

const Field = ({ label, ...p }) => (
  <div><Label className="text-sm font-medium text-zinc-700">{label}</Label><Input className="mt-1.5 border-zinc-300 focus-visible:ring-royal/30" {...p} /></div>
);
const Toggle = ({ label, desc, defaultChecked = false, testId }) => (
  <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
    <div><p className="text-sm font-medium text-zinc-800">{label}</p>{desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}</div>
    <Switch defaultChecked={defaultChecked} data-testid={testId} />
  </div>
);
const Card = ({ title, children }) => (
  <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-6">
    <h3 className="font-heading text-base font-bold text-zinc-900 mb-4">{title}</h3>
    {children}
  </div>
);

export default function SettingsPage() {
  const [tab, setTab] = useState("company");
  const save = () => toast.success("Settings saved successfully");

  const FIELD_TYPES = [
    { value: "text", label: "Text" },
    { value: "textarea", label: "Long Text" },
    { value: "number", label: "Number" },
    { value: "select", label: "Dropdown" },
    { value: "date", label: "Date" },
  ];
  const emptyField = () => ({ label: "", type: "text", required: false, optionsText: "" });
  const emptyConfig = () => ({ name: "", description: "", enabled: true, fields: [emptyField()] });

  const [configs, setConfigs] = useState([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [newConfig, setNewConfig] = useState(emptyConfig());
  const [editingId, setEditingId] = useState(null);

  const loadConfigs = async () => {
    setConfigsLoading(true);
    try {
      const r = await api.get("/admin/dynamic-config");
      const payload = r?.data;
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      setConfigs(rows);
    } catch(e) {
      setConfigs([]);
      toast.error(describeApiError(e, "Unable to load dynamic configuration"));
    } finally {
      setConfigsLoading(false);
    }
  };
  useEffect(() => { if (tab === "dynamic") loadConfigs(); }, [tab]);

  const setField = (idx, patch) => {
    setNewConfig((c) => ({
      ...c,
      fields: c.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };
  const addField = () => setNewConfig((c) => ({ ...c, fields: [...c.fields, emptyField()] }));
  const removeField = (idx) => setNewConfig((c) => ({ ...c, fields: c.fields.filter((_, i) => i !== idx) }));

  const resetForm = () => { setEditingId(null); setNewConfig(emptyConfig()); };

  const startEdit = (c) => {
    const configId = c?.id ?? c?._id ?? null;
    if (!configId) return toast.error("This module has no valid ID.");
    setEditingId(configId);
    setNewConfig({
      name: c.name || "",
      description: c.description || "",
      enabled: c.enabled !== false,
      fields: (c.fields && c.fields.length > 0)
        ? c.fields.map((f) => ({
            label: f.label || "", type: f.type || "text",
            required: !!f.required, optionsText: (f.options || []).join(", "),
          }))
        : [emptyField()],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildPayload = () => {
    const fields = newConfig.fields
      .filter((f) => f.label.trim())
      .map((f) => ({
        label: f.label.trim(),
        type: f.type,
        required: !!f.required,
        options: f.type === "select"
          ? f.optionsText.split(",").map((o) => o.trim()).filter(Boolean)
          : [],
      }));
    return { name: newConfig.name, description: newConfig.description, enabled: newConfig.enabled, fields, options: [], sections: [], content: [] };
  };

  const saveConfig = async () => {
    if (!newConfig.name.trim()) return toast.error("Module name is required");
    const fieldsWithLabels = newConfig.fields.filter((f) => f.label.trim());
    if (fieldsWithLabels.length === 0) return toast.error("Add at least one field");
    for (const f of fieldsWithLabels) {
      if (f.type === "select" && !f.optionsText.split(",").map((o) => o.trim()).filter(Boolean).length) {
        return toast.error(`"${f.label}" is a Dropdown but has no options. Add comma-separated options.`);
      }
    }
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/admin/dynamic-config/${encodeURIComponent(editingId)}`, payload);
        toast.success("Module updated");
      } else {
        await api.post("/admin/dynamic-config", payload);
        toast.success("Module created");
      }
      resetForm();
      await loadConfigs();
      notifyDynamicModulesChanged();
    } catch (e) {
      toast.error(describeApiError(e, editingId ? "Unable to update module" : "Unable to create module"));
    }
  };

  const removeConfig = async (id) => {
    if (!id) return toast.error("This module has no valid ID.");
    try {
      await api.delete(`/admin/dynamic-config/${encodeURIComponent(id)}`);
      if (editingId === id) resetForm();
      await loadConfigs();
      notifyDynamicModulesChanged();
      toast.success("Module deleted");
    } catch(e) {
      toast.error(describeApiError(e, "Unable to delete module"));
    }
  };

  // ---------------- Centralized image management ----------------
  const emptyImage = () => ({ title: "", placement: "home", image: "", status: "Active" });
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageForm, setImageForm] = useState(emptyImage());
  const [editingImageId, setEditingImageId] = useState(null);
  const [imageFileName, setImageFileName] = useState("");

  const loadImages = async () => {
    setImagesLoading(true);
    try {
      const { data } = await api.get("/site-images");
      setImages(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (e) {
      setImages([]);
      toast.error(describeApiError(e, "Unable to load images"));
    } finally {
      setImagesLoading(false);
    }
  };
  useEffect(() => { if (tab === "images") loadImages(); }, [tab]);

  const setImageField = (k, v) => setImageForm((f) => ({ ...f, [k]: v }));
  const resetImageForm = () => { setEditingImageId(null); setImageForm(emptyImage()); setImageFileName(""); };

  const onImageFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large. Please choose a file under 5MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setImageField("image", String(reader.result)); setImageFileName(f.name); };
    reader.readAsDataURL(f);
  };

  const startEditImage = (img) => {
    setEditingImageId(img.id);
    setImageForm({
      title: img.title || "",
      placement: IMAGE_PLACEMENTS.some((p) => p.value === img.placement) ? img.placement : "home",
      image: img.image || "",
      status: img.status || "Active",
    });
    setImageFileName("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveImage = async () => {
    if (!imageForm.image.trim()) return toast.error("Upload an image or paste an image URL");
    if (!imageForm.placement) return toast.error("Select where this image should appear");
    try {
      if (editingImageId) {
        await api.put(`/site-images/${encodeURIComponent(editingImageId)}`, imageForm);
        toast.success("Image updated");
      } else {
        await api.post("/site-images", imageForm);
        toast.success("Image added");
      }
      resetImageForm();
      await loadImages();
    } catch (e) {
      toast.error(describeApiError(e, editingImageId ? "Unable to update image" : "Unable to add image"));
    }
  };

  const removeImage = async (id) => {
    if (!id) return;
    try {
      await api.delete(`/site-images/${encodeURIComponent(id)}`);
      if (editingImageId === id) resetImageForm();
      await loadImages();
      toast.success("Image deleted");
    } catch (e) {
      toast.error(describeApiError(e, "Unable to delete image"));
    }
  };

  // ---------------- Customer/Home page images (fixed 3 slots) ----------------
  // Separate from the "Featured" gallery above: these are the 3 images the
  // Customer/Home page has always shown (hero, analytics, office banners),
  // now editable here instead of hardcoded. Not a list you add/remove from —
  // always exactly 3 stable slots.
  const [homeImages, setHomeImages] = useState([]);
  const [homeImagesLoading, setHomeImagesLoading] = useState(false);
  const [editingHomeImageKey, setEditingHomeImageKey] = useState(null);
  const [homeImageDraft, setHomeImageDraft] = useState("");
  const [homeImageDraftFileName, setHomeImageDraftFileName] = useState("");

  const loadHomeImages = async () => {
    setHomeImagesLoading(true);
    try {
      const { data } = await api.get("/admin/home-images");
      setHomeImages(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      toast.error(describeApiError(e, "Unable to load Home page images"));
    } finally {
      setHomeImagesLoading(false);
    }
  };
  useEffect(() => { if (tab === "images") loadHomeImages(); }, [tab]);

  const startEditHomeImage = (img) => {
    setEditingHomeImageKey(img.id);
    setHomeImageDraft(img.image || "");
    setHomeImageDraftFileName("");
  };
  const cancelEditHomeImage = () => {
    setEditingHomeImageKey(null);
    setHomeImageDraft("");
    setHomeImageDraftFileName("");
  };
  const onHomeImageFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large. Please choose a file under 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setHomeImageDraft(String(reader.result)); setHomeImageDraftFileName(f.name); };
    reader.readAsDataURL(f);
  };
  const saveHomeImage = async (key) => {
    if (!homeImageDraft.trim()) return toast.error("Upload an image or paste an image URL");
    try {
      await api.put(`/admin/home-images/${encodeURIComponent(key)}`, { image: homeImageDraft });
      toast.success("Home page image updated");
      cancelEditHomeImage();
      await loadHomeImages();
    } catch (e) {
      toast.error(describeApiError(e, "Unable to update image"));
    }
  };
  const toggleHomeImageStatus = async (img) => {
    const status = img.status === "Active" ? "Inactive" : "Active";
    try {
      await api.put(`/admin/home-images/${encodeURIComponent(img.id)}`, { status });
      await loadHomeImages();
    } catch (e) {
      toast.error(describeApiError(e, "Unable to update image status"));
    }
  };

  const toggleImageStatus = async (img) => {
    try {
      const status = img.status === "Active" ? "Inactive" : "Active";
      await api.put(`/site-images/${encodeURIComponent(img.id)}`, { status });
      await loadImages();
    } catch (e) {
      toast.error(describeApiError(e, "Unable to update image status"));
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        breadcrumb={["Super Admin", "Settings"]}
        subtitle="Configure company, branding, integrations, tax defaults, roles and security."
        actions={<Button className="bg-royal text-white hover:bg-royal-hover font-semibold" onClick={save} data-testid="settings-save"><Save className="h-4 w-4 mr-1.5" />Save changes</Button>}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto bg-zinc-100 p-1 gap-1 mb-6">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="data-[state=active]:bg-white data-[state=active]:text-royal text-xs" data-testid={`settings-tab-${t.key}`}>
              <t.icon className="h-4 w-4 mr-1.5" />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="company"><Card title="Company Information">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Company Name" defaultValue="NTAXCO — Nizam's Tax Consultancy" />
            <Field label="Legal Entity" defaultValue="NTAXCO Advisory LLP" />
            <Field label="GSTIN" defaultValue="29ABCDE1234F1Z5" />
            <Field label="PAN" defaultValue="ABCDE1234F" />
            <Field label="Contact Email" defaultValue="support@ntaxco.com" />
            <Field label="Contact Phone" defaultValue="+91 98765 43210" />
            <div className="sm:col-span-2"><Field label="Registered Address" defaultValue="Plot 12, HITEC City, Hyderabad, Telangana 500081" /></div>
          </div>
        </Card></TabsContent>

        <TabsContent value="branding"><Card title="Branding & Theme">
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div><Label className="text-sm font-medium text-zinc-700">Primary (Royal Blue)</Label><div className="mt-1.5 flex items-center gap-2"><span className="h-9 w-9 rounded-lg bg-royal border border-zinc-200" /><Input defaultValue="#1E40AF" className="border-zinc-300" /></div></div>
            <div><Label className="text-sm font-medium text-zinc-700">Accent (Yellow)</Label><div className="mt-1.5 flex items-center gap-2"><span className="h-9 w-9 rounded-lg bg-brand border border-zinc-200" /><Input defaultValue="#FFB800" className="border-zinc-300" /></div></div>
            <div><Label className="text-sm font-medium text-zinc-700">Logo</Label><Button variant="outline" className="mt-1.5 w-full border-zinc-300" onClick={() => toast.info("Logo upload requires a configured site-image storage workflow.")}>Upload Logo</Button></div>
          </div>
          <Toggle label="Dark sidebar" desc="Use a dark royal-blue sidebar across portals." testId="set-dark-sidebar" />
          <Toggle label="Show company name in header" defaultChecked testId="set-show-name" />
        </Card></TabsContent>

        <TabsContent value="comms"><div className="space-y-6">
          <Card title="Email (SMTP)"><div className="grid sm:grid-cols-2 gap-4"><Field label="SMTP Host" defaultValue="smtp.ntaxco.com" /><Field label="Port" defaultValue="587" /><Field label="From Email" defaultValue="no-reply@ntaxco.com" /><Field label="Sender Name" defaultValue="NTAXCO ERP" /></div><div className="mt-2"><Toggle label="Enable email notifications" defaultChecked testId="set-email-enable" /></div></Card>
          <Card title="SMS Gateway"><div className="grid sm:grid-cols-2 gap-4"><Field label="Provider" defaultValue="MSG91" /><Field label="Sender ID" defaultValue="NTAXCO" /></div><Toggle label="Enable SMS alerts" defaultChecked testId="set-sms-enable" /></Card>
          <Card title="WhatsApp Business"><div className="grid sm:grid-cols-2 gap-4"><Field label="Business Number" defaultValue="+91 98765 43210" /><Field label="API Provider" defaultValue="Meta Cloud API" /></div><Toggle label="Enable WhatsApp support widget" defaultChecked testId="set-wa-enable" /></Card>
        </div></TabsContent>

        <TabsContent value="ai"><Card title="AI Tax Copilot">
          <div className="grid sm:grid-cols-2 gap-4 mb-2">
            <div><Label className="text-sm font-medium text-zinc-700">Model</Label>
              <Select defaultValue="gpt-5.4"><SelectTrigger className="mt-1.5 border-zinc-300" data-testid="set-ai-model"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="gpt-5.4">OpenAI GPT-5.4</SelectItem><SelectItem value="gemini-3">Gemini 3 Flash</SelectItem><SelectItem value="claude-5">Claude Sonnet 5</SelectItem></SelectContent>
              </Select>
            </div>
            <Field label="Max tokens per reply" type="number" defaultValue="1200" />
          </div>
          <Toggle label="Enable AI Copilot" desc="Live GST / Income Tax / TDS assistant for customers." defaultChecked testId="set-ai-enable" />
          <Toggle label="Show tax-saving suggestions" defaultChecked testId="set-ai-tips" />
        </Card></TabsContent>

        <TabsContent value="tax"><Card title="Tax & GST Defaults">
          <div className="grid sm:grid-cols-3 gap-4">
            <div><Label className="text-sm font-medium text-zinc-700">Default GST Rate</Label>
              <Select defaultValue="18"><SelectTrigger className="mt-1.5 border-zinc-300" data-testid="set-gst-rate"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{["0", "5", "12", "18", "28"].map((r) => <SelectItem key={r} value={r}>{r}%</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm font-medium text-zinc-700">Tax Regime</Label>
              <Select defaultValue="new"><SelectTrigger className="mt-1.5 border-zinc-300"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="new">New Regime</SelectItem><SelectItem value="old">Old Regime</SelectItem></SelectContent>
              </Select>
            </div>
            <Field label="Financial Year" defaultValue="2025-26" />
          </div>
          <div className="mt-2"><Toggle label="Auto compliance reminders" desc="GST, ITR, TDS & ROC due-date alerts." defaultChecked testId="set-reminders" /></div>
        </Card></TabsContent>

        <TabsContent value="invoice"><div className="space-y-6">
          <Card title="Invoice Settings"><div className="grid sm:grid-cols-2 gap-4"><Field label="Invoice Prefix" defaultValue="INV-" /><Field label="Next Invoice No." defaultValue="3009" /><Field label="Payment Terms (days)" type="number" defaultValue="15" /><Field label="Default Currency" defaultValue="INR (₹)" /></div><Toggle label="Auto-send invoice on generation" defaultChecked testId="set-inv-auto" /></Card>
          <Card title="Payroll Settings"><div className="grid sm:grid-cols-2 gap-4"><Field label="Pay Cycle" defaultValue="Monthly" /><Field label="PF %" defaultValue="12" /><Field label="ESI %" defaultValue="0.75" /><Field label="Professional Tax (₹)" defaultValue="200" /></div></Card>
        </div></TabsContent>

        <TabsContent value="roles"><Card title="User Roles & Permissions">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-200"><th className="py-2 pr-4">Role</th><th className="py-2 px-4">Users</th><th className="py-2 px-4">Access Level</th><th className="py-2 px-4">Status</th></tr></thead>
            <tbody>
              {[["Super Admin", 1, "Full Control"], ["Tax Manager", 2, "Manage Team & Clients"], ["Employee", 5, "Assigned Work"], ["Tax Consultant", 8, "Assigned Clients"], ["Customer", 250, "Self-service"]].map((r) => (
                <tr key={r[0]} className="border-b border-zinc-100"><td className="py-3 pr-4 font-medium text-zinc-800">{r[0]}</td><td className="py-3 px-4">{r[1]}</td><td className="py-3 px-4 text-muted-foreground">{r[2]}</td><td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span></td></tr>
              ))}
            </tbody>
          </table></div>
        </Card></TabsContent>

        <TabsContent value="security"><Card title="Security">
          <Toggle label="Two-Factor Authentication" desc="Require OTP for admin logins." defaultChecked testId="set-2fa" />
          <Toggle label="Enforce strong password policy" desc="Min 8 chars, 1 uppercase, 1 number, 1 symbol." defaultChecked testId="set-pwd" />
          <Toggle label="Auto-logout on inactivity" testId="set-idle" />
          <div className="grid sm:grid-cols-2 gap-4 mt-4"><Field label="Session Timeout (min)" type="number" defaultValue="30" /><Field label="Max Login Attempts" type="number" defaultValue="5" /></div>
          <div className="mt-4"><Label className="text-sm font-medium text-zinc-700">API Key</Label><div className="mt-1.5 flex gap-2"><Input readOnly defaultValue="ntx_live_••••••••••••7f3c" className="border-zinc-300 font-mono text-xs" /><Button variant="outline" className="border-zinc-300" onClick={() => toast.success("New API key generated")}>Regenerate</Button></div></div>
        </Card></TabsContent>

        <TabsContent value="notif"><Card title="Notification Preferences">
          <Toggle label="Compliance deadline alerts" defaultChecked testId="np-deadline" />
          <Toggle label="Invoice & payment updates" defaultChecked testId="np-invoice" />
          <Toggle label="New customer registrations" defaultChecked testId="np-customer" />
          <Toggle label="Document approvals & rejections" defaultChecked testId="np-docs" />
          <Toggle label="Employee leave & attendance" testId="np-hr" />
          <Toggle label="WhatsApp inquiries" defaultChecked testId="np-wa" />
        </Card></TabsContent>

        <TabsContent value="dynamic"><div className="space-y-6">
          <Card title={editingId ? "Edit Module" : "Create a New Module"}>
            <p className="text-sm text-muted-foreground mb-4">Create admin-controlled ERP modules with custom fields. Each module automatically gets a sidebar entry, its own page, and full Add / Edit / Delete records backed by MongoDB.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Module name" value={newConfig.name} onChange={e=>setNewConfig({...newConfig,name:e.target.value})} placeholder="e.g. Client Feedback" />
              <Field label="Description" value={newConfig.description} onChange={e=>setNewConfig({...newConfig,description:e.target.value})} placeholder="Optional — shown in the module list" />
            </div>
            <div className="flex items-center justify-between py-3 mt-2 border-t border-zinc-100">
              <div><p className="text-sm font-medium text-zinc-800">Enabled</p><p className="text-xs text-muted-foreground mt-0.5">Disabled modules are hidden from the sidebar and can't accept new records.</p></div>
              <Switch checked={newConfig.enabled} onCheckedChange={(v) => setNewConfig({ ...newConfig, enabled: v })} />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold text-zinc-800">Fields</Label>
                <Button type="button" size="sm" variant="outline" className="border-zinc-300" onClick={addField}><Plus className="h-3.5 w-3.5 mr-1"/>Add field</Button>
              </div>
              <div className="space-y-3">
                {newConfig.fields.map((f, idx) => (
                  <div key={idx} className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/60">
                    <div className="grid sm:grid-cols-[1fr_180px_auto_auto] gap-3 items-end">
                      <div>
                        <Label className="text-xs text-zinc-500">Field label</Label>
                        <Input className="mt-1 border-zinc-300" value={f.label} onChange={(e) => setField(idx, { label: e.target.value })} placeholder="e.g. Customer Name" data-testid={`dyn-field-label-${idx}`} />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Type</Label>
                        <Select value={f.type} onValueChange={(v) => setField(idx, { type: v })}>
                          <SelectTrigger className="mt-1 border-zinc-300" data-testid={`dyn-field-type-${idx}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white">
                            {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Checkbox checked={f.required} onCheckedChange={(v) => setField(idx, { required: !!v })} id={`dyn-required-${idx}`} />
                        <Label htmlFor={`dyn-required-${idx}`} className="text-xs text-zinc-600 whitespace-nowrap">Required</Label>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeField(idx)} disabled={newConfig.fields.length === 1} data-testid={`dyn-field-remove-${idx}`}>
                        <XIcon className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    {f.type === "select" && (
                      <div className="mt-2">
                        <Label className="text-xs text-zinc-500">Dropdown options (comma-separated)</Label>
                        <Input className="mt-1 border-zinc-300" value={f.optionsText} onChange={(e) => setField(idx, { optionsText: e.target.value })} placeholder="e.g. GST, Income Tax, TDS, Accounting" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <Button onClick={saveConfig} className="bg-royal text-white" data-testid="dyn-save-module">
                {editingId ? <><Save className="h-4 w-4 mr-1"/>Update module</> : <><Plus className="h-4 w-4 mr-1"/>Add module</>}
              </Button>
              {editingId && <Button variant="outline" onClick={resetForm}>Cancel edit</Button>}
              <Button variant="outline" onClick={loadConfigs}><RefreshCw className="h-4 w-4 mr-1"/>Refresh</Button>
            </div>
          </Card>

          <div className="grid gap-4">
            {configsLoading && (
              <Card title="Loading modules..."><p className="text-sm text-muted-foreground">Please wait.</p></Card>
            )}
            {!configsLoading && configs.length === 0 && (
              <p className="text-sm text-muted-foreground">No modules configured yet. Create one above — it will instantly appear in the sidebar.</p>
            )}
            {!configsLoading && configs.map((c, index) => {
              const configId = c?.id ?? c?._id ?? c?.key ?? null;
              return (
                <Card key={configId || `config-${index}`} title={c?.name || c?.key || "Untitled module"}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">{c?.description || "No description"}</p>
                      <p className="text-xs mt-2 text-zinc-500">{c?.fields?.length || 0} field{(c?.fields?.length || 0) === 1 ? "" : "s"} · {c?.enabled === false ? "Disabled" : "Enabled"} · /admin/{c?.key}</p>
                      {c?.fields?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {c.fields.map((f) => (
                            <span key={f.key} className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">{f.label}{f.required ? " *" : ""}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {c?.key && (
                        <Button asChild variant="outline" size="sm" className="border-zinc-300">
                          <Link to={`/admin/${c.key}`}><ExternalLink className="h-3.5 w-3.5 mr-1"/>Open</Link>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5 mr-1"/>Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => removeConfig(configId)}><Trash2 className="h-3.5 w-3.5 mr-1"/>Delete</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div></TabsContent>
        <TabsContent value="images"><div className="space-y-6">
          <Card title="Home Page Images">
            <p className="text-sm text-muted-foreground mb-4">The 3 images shown on the Customer/Home page. Replace any of them below — the change appears on the Home page automatically, no code changes needed. These are not part of Featured Images.</p>
            {homeImagesLoading ? <div className="text-sm text-zinc-500">Loading images...</div> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {homeImages.map((img, i) => (
                  <div key={img.id} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                    <div className="h-32 bg-zinc-100">
                      <img src={editingHomeImageKey === img.id && homeImageDraft ? homeImageDraft : img.image} alt={img.label || `Home Page Image ${i + 1}`} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-zinc-900 truncate">{img.label || `Home Page Image ${i + 1}`}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${img.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>{img.status || "Active"}</span>
                      </div>

                      {editingHomeImageKey === img.id ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" className="border-zinc-300" onClick={() => document.getElementById(`home-image-upload-${img.id}`)?.click()}>
                              <UploadCloud className="h-3.5 w-3.5 mr-1" />Choose file
                            </Button>
                            {homeImageDraftFileName && <span className="text-xs text-zinc-500 truncate">{homeImageDraftFileName}</span>}
                          </div>
                          <input id={`home-image-upload-${img.id}`} type="file" accept="image/*" className="hidden" onChange={onHomeImageFileChange} data-testid={`home-img-file-${i + 1}`} />
                          <Input className="border-zinc-300 text-xs" value={homeImageDraft.startsWith("data:") ? "" : homeImageDraft} onChange={(e) => setHomeImageDraft(e.target.value)} placeholder="Or paste an image URL" data-testid={`home-img-url-${i + 1}`} />
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="bg-royal text-white" onClick={() => saveHomeImage(img.id)} data-testid={`home-img-save-${i + 1}`}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
                            <Button size="sm" variant="outline" onClick={cancelEditHomeImage}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => startEditHomeImage(img)} data-testid={`home-img-edit-${i + 1}`}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                          <Button variant="outline" size="sm" onClick={() => toggleHomeImageStatus(img)} data-testid={`home-img-toggle-${i + 1}`}>{img.status === "Active" ? "Deactivate" : "Activate"}</Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={editingImageId ? "Edit Featured Image" : "Add Featured Image"}>
            <p className="text-sm text-muted-foreground mb-4">Upload an image and choose which customer page it should appear on. It shows up automatically — no code changes needed. (This is the separate Featured Images gallery — for the 3 fixed Home page images, use Home Page Images above.)</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Title (optional)" value={imageForm.title} onChange={(e) => setImageField("title", e.target.value)} placeholder="e.g. Homepage hero banner" data-testid="img-title" />
              <div>
                <Label className="text-sm font-medium text-zinc-700">Placement</Label>
                <Select value={imageForm.placement} onValueChange={(v) => setImageField("placement", v)}>
                  <SelectTrigger className="mt-1.5 border-zinc-300" data-testid="img-placement"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {IMAGE_PLACEMENTS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4 items-start">
              <div>
                <Label className="text-sm font-medium text-zinc-700">Upload image (PNG, JPG, JPEG, GIF, WEBP, SVG)</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Button type="button" variant="outline" className="border-zinc-300" onClick={() => document.getElementById("site-image-upload")?.click()}>
                    <UploadCloud className="h-4 w-4 mr-1.5" />Choose file
                  </Button>
                  {imageFileName && <span className="text-xs text-zinc-500 truncate">{imageFileName}</span>}
                </div>
                <input id="site-image-upload" type="file" accept="image/*" className="hidden" onChange={onImageFileChange} data-testid="img-file" />
                <Label className="mt-3 block text-sm font-medium text-zinc-700">Or paste an image URL</Label>
                <Input className="mt-1.5 border-zinc-300" value={imageForm.image.startsWith("data:") ? "" : imageForm.image} onChange={(e) => setImageField("image", e.target.value)} placeholder="https://..." data-testid="img-url" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-700">Preview</Label>
                <div className="mt-1.5 h-32 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center overflow-hidden">
                  {imageForm.image ? <img src={imageForm.image} alt="Preview" className="h-full w-full object-cover" /> : <span className="text-xs text-zinc-400">No image selected</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 mt-4 border-t border-zinc-100">
              <div><p className="text-sm font-medium text-zinc-800">Active</p><p className="text-xs text-muted-foreground mt-0.5">Inactive images are hidden from the customer site but kept here.</p></div>
              <Switch checked={imageForm.status === "Active"} onCheckedChange={(v) => setImageField("status", v ? "Active" : "Inactive")} />
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={saveImage} className="bg-royal text-white" data-testid="img-save">
                {editingImageId ? <><Save className="h-4 w-4 mr-1" />Update image</> : <><Plus className="h-4 w-4 mr-1" />Add image</>}
              </Button>
              {editingImageId && <Button variant="outline" onClick={resetImageForm}>Cancel edit</Button>}
              <Button variant="outline" onClick={loadImages}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
            </div>
          </Card>

          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-zinc-100"><h3 className="font-heading font-bold">Featured Images (uploaded)</h3></div>
            {imagesLoading ? <div className="p-6 text-sm text-zinc-500">Loading images...</div> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                {images.map((img) => (
                  <div key={img.id} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                    <div className="h-32 bg-zinc-100"><img src={img.image} alt={img.title || "Uploaded"} className="h-full w-full object-cover" /></div>
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-zinc-900 truncate">{img.title || "Untitled image"}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${img.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>{img.status || "Active"}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 capitalize">{IMAGE_PLACEMENTS.find((p) => p.value === img.placement)?.label || img.placement}</p>
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" className="border-zinc-300" onClick={() => startEditImage(img)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => toggleImageStatus(img)}>{img.status === "Active" ? "Deactivate" : "Activate"}</Button>
                        <Button variant="outline" size="sm" onClick={() => removeImage(img.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
                      </div>
                    </div>
                  </div>
                ))}
                {!images.length && <p className="text-sm text-muted-foreground col-span-full">No images uploaded yet. Add one above — it will appear on the selected customer page automatically.</p>}
              </div>
            )}
          </div>
        </div></TabsContent>

        <TabsContent value="system"><div className="space-y-6">
          <Card title="System & License">
            <div className="grid sm:grid-cols-2 gap-y-3 gap-x-8 text-sm">
              {[["Product", "NTAXCO ERP Enterprise"], ["Version", "v2.4.0"], ["License", "Enterprise — 250 seats"], ["Valid Till", "31 Mar 2027"], ["Environment", "Production"], ["Support", "support@ntaxco.com"]].map((r) => (
                <div key={r[0]} className="flex justify-between border-b border-zinc-100 py-2"><span className="text-muted-foreground">{r[0]}</span><span className="font-medium text-zinc-800">{r[1]}</span></div>
              ))}
            </div>
          </Card>
          <Card title="Backup & Restore">
            <div className="flex flex-wrap gap-3"><Button variant="outline" className="border-zinc-300" onClick={() => toast.info("Configure the server backup provider before using Backup Now.")}>Backup Now</Button><Button variant="outline" className="border-zinc-300" onClick={() => toast.info("Restore requires a configured backup source")}>Restore</Button><Button variant="outline" className="border-zinc-300" onClick={() => toast.info("System logs are available from the server logging configuration")}>View System Logs</Button></div>
            <div className="mt-4"><Toggle label="Automatic daily backup" defaultChecked testId="set-backup" /></div>
          </Card>
        </div></TabsContent>
      </Tabs>
    </div>
  );
}
