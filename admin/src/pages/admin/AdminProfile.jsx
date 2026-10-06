import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api, { describeApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  UserCog, Camera, Trash2, RefreshCw, Pencil, X, Save, Upload,
  FileText, Download, Loader2, ShieldCheck, Plus, ListPlus, SlidersHorizontal,
} from "lucide-react";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_DOC_BYTES = 5 * 1024 * 1024;

const emptyForm = () => ({
  admin_name: "", mobile: "", alternate_mobile: "", email: "", dob: "",
  gender: "", designation: "", address: "", city: "", state: "",
  country: "", pincode: "",
  company_name: "", gst_number: "", pan_number: "", tan_number: "",
  cin_number: "", business_address: "", registered_address: "", office_address: "",
  website: "", alternate_email: "", notes: "", description: "",
});

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

const DOC_TYPES = [
  { value: "gst_certificate", label: "GST Certificate" },
  { value: "pan_document", label: "PAN Document" },
  { value: "business_registration", label: "Business Registration Certificate" },
  { value: "address_proof", label: "Address Proof" },
  { value: "other", label: "Other Document" },
];

const CUSTOM_FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "textarea", label: "Textarea" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "File" },
  { value: "url", label: "URL" },
];

const emptyCustomFieldDraft = () => ({
  field_name: "", field_type: "text", required: false,
  options: [], optionsText: "", value: "", checkboxValue: false, fileName: "",
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Field({ label, children, full }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReadRow({ label, value }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-muted-foreground w-44 shrink-0">{label}</span>
      <span className="text-sm font-medium text-zinc-800 text-right ml-auto break-all">{value || "—"}</span>
    </div>
  );
}

export default function AdminProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [photoUploading, setPhotoUploading] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docUploading, setDocUploading] = useState(false);
  const [docType, setDocType] = useState("gst_certificate");

  const [customFields, setCustomFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [fieldDraft, setFieldDraft] = useState(emptyCustomFieldDraft());
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState(null);
  const [fieldDeleting, setFieldDeleting] = useState(false);

  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const customFileInputRef = useRef(null);

  const loadProfile = useCallback(async ({ silent } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get("/admin/profile/me");
      const data = res.data?.data || null;
      setProfile(data);
      if (data) {
        setForm((f) => ({ ...emptyForm(), ...f, ...data }));
      }
    } catch (e) {
      toast.error(describeApiError(e, "Unable to load your admin profile"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await api.get("/admin/profile/me/documents");
      setDocuments(res.data?.data || []);
    } catch (e) {
      toast.error(describeApiError(e, "Unable to load documents"));
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const loadCustomFields = useCallback(async () => {
    setFieldsLoading(true);
    try {
      const res = await api.get("/admin/profile/me/custom-fields");
      setCustomFields(res.data?.data || []);
    } catch (e) {
      toast.error(describeApiError(e, "Unable to load custom fields"));
    } finally {
      setFieldsLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); loadDocuments(); loadCustomFields(); }, [loadProfile, loadDocuments, loadCustomFields]);

  // Prevent duplicate requests from repeated Refresh clicks (spec 20.8).
  const onRefresh = () => {
    if (refreshing) return;
    loadProfile({ silent: true });
    loadDocuments();
    loadCustomFields();
  };

  const openAddField = () => {
    setEditingFieldId(null);
    setFieldDraft(emptyCustomFieldDraft());
    setFieldModalOpen(true);
  };

  const openEditField = (field) => {
    setEditingFieldId(field.id);
    setFieldDraft({
      field_name: field.field_name,
      field_type: field.field_type,
      required: !!field.required,
      options: field.options || [],
      optionsText: (field.options || []).join(", "),
      value: field.field_type === "checkbox" ? "" : (field.value ?? ""),
      checkboxValue: field.field_type === "checkbox" ? !!field.value : false,
      fileName: field.file_name || "",
    });
    setFieldModalOpen(true);
  };

  const closeFieldModal = () => {
    if (fieldSaving) return;
    setFieldModalOpen(false);
  };

  const onCustomFileChange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const allowed = [
      "application/pdf", "image/jpeg", "image/png", "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowed.includes(f.type)) {
      toast.error("Supported types: PDF, JPEG, PNG, WEBP, DOCX, XLSX");
      return;
    }
    if (f.size > MAX_DOC_BYTES) {
      toast.error("File is too large. Please choose a file under 5MB.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(f);
    setFieldDraft((d) => ({ ...d, value: dataUrl, fileName: f.name }));
  };

  const saveCustomField = async () => {
    const field_name = fieldDraft.field_name.trim();
    if (!field_name) {
      toast.error("Field name is required");
      return;
    }
    if (fieldDraft.field_type === "dropdown") {
      const options = fieldDraft.optionsText.split(",").map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) {
        toast.error("Add at least one dropdown option");
        return;
      }
    }
    const value = fieldDraft.field_type === "checkbox" ? fieldDraft.checkboxValue : fieldDraft.value;
    if (fieldDraft.required && (value === "" || value === null || value === undefined)) {
      toast.error("This field is required — please provide a value");
      return;
    }

    setFieldSaving(true);
    try {
      const payload = {
        field_name,
        field_type: fieldDraft.field_type,
        required: fieldDraft.required,
        value,
      };
      if (fieldDraft.field_type === "dropdown") {
        payload.options = fieldDraft.optionsText.split(",").map((o) => o.trim()).filter(Boolean);
      }
      if (fieldDraft.field_type === "file" && fieldDraft.fileName) {
        payload.file_name = fieldDraft.fileName;
      }
      if (editingFieldId) {
        await api.put(`/admin/profile/me/custom-fields/${encodeURIComponent(editingFieldId)}`, payload);
        toast.success("Custom field updated");
      } else {
        await api.post("/admin/profile/me/custom-fields", payload);
        toast.success("Custom field added");
      }
      setFieldModalOpen(false);
      loadCustomFields();
    } catch (err) {
      toast.error(describeApiError(err, "Unable to save custom field"));
    } finally {
      setFieldSaving(false);
    }
  };

  const confirmDeleteField = async () => {
    if (!fieldToDelete) return;
    setFieldDeleting(true);
    try {
      await api.delete(`/admin/profile/me/custom-fields/${encodeURIComponent(fieldToDelete.id)}`);
      setCustomFields((prev) => prev.filter((f) => f.id !== fieldToDelete.id));
      toast.success("Custom field deleted");
      setFieldToDelete(null);
    } catch (err) {
      toast.error(describeApiError(err, "Unable to delete custom field"));
    } finally {
      setFieldDeleting(false);
    }
  };

  const downloadCustomFieldFile = async (field) => {
    try {
      const res = await api.get(`/admin/profile/me/custom-fields/${encodeURIComponent(field.id)}/file`);
      const full = res.data?.data;
      if (!full?.file_data) throw new Error("File data missing");
      const a = document.createElement("a");
      a.href = full.file_data;
      a.download = full.file_name || field.field_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(describeApiError(err, "Unable to download file"));
    }
  };

  const startEdit = () => {
    setForm((f) => ({ ...emptyForm(), ...f, ...(profile || {}) }));
    setEditing(true);
  };
  const cancelEdit = () => {
    setForm((f) => ({ ...emptyForm(), ...f, ...(profile || {}) }));
    setEditing(false);
  };
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.put("/admin/profile/me", form);
      setProfile(res.data?.data || null);
      setEditing(false);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(describeApiError(e, "Unable to save profile"));
    } finally {
      setSaving(false);
    }
  };

  const onPhotoChange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("Please choose a JPEG, PNG or WEBP image");
      return;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      toast.error("Photo is too large. Please choose an image under 5MB.");
      return;
    }
    setPhotoUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(f);
      const res = await api.post("/admin/profile/me/photo", { image: dataUrl });
      setProfile(res.data?.data || null);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(describeApiError(err, "Unable to upload photo"));
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = async () => {
    setPhotoUploading(true);
    try {
      const res = await api.delete("/admin/profile/me/photo");
      setProfile(res.data?.data || null);
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error(describeApiError(err, "Unable to remove photo"));
    } finally {
      setPhotoUploading(false);
    }
  };

  const onDocFileChange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const allowed = [
      "application/pdf", "image/jpeg", "image/png", "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowed.includes(f.type)) {
      toast.error("Supported types: PDF, JPEG, PNG, WEBP, DOCX, XLSX");
      return;
    }
    if (f.size > MAX_DOC_BYTES) {
      toast.error("Document is too large. Please choose a file under 5MB.");
      return;
    }
    setDocUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(f);
      await api.post("/admin/profile/me/documents", {
        doc_type: docType,
        file_name: f.name,
        file_data: dataUrl,
      });
      toast.success("Document uploaded");
      loadDocuments();
    } catch (err) {
      toast.error(describeApiError(err, "Unable to upload document"));
    } finally {
      setDocUploading(false);
    }
  };

  const downloadDocument = async (doc) => {
    try {
      const res = await api.get(`/admin/profile/me/documents/${encodeURIComponent(doc.id)}`);
      const full = res.data?.data;
      if (!full?.file_data) throw new Error("File data missing");
      const a = document.createElement("a");
      a.href = full.file_data;
      a.download = full.file_name || `${full.label || "document"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(describeApiError(err, "Unable to download document"));
    }
  };

  const deleteDocument = async (doc) => {
    try {
      await api.delete(`/admin/profile/me/documents/${encodeURIComponent(doc.id)}`);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Document deleted");
    } catch (err) {
      toast.error(describeApiError(err, "Unable to delete document"));
    }
  };

  const initials = (form.admin_name || user?.name || "A")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <PageHeader
        title="Admin Profile"
        breadcrumb={["Admin", "Admin Profile"]}
        subtitle="Your individual administrator details — separate from the company profile."
        actions={
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing || loading}
            data-testid="admin-profile-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading profile…
        </div>
      ) : (
        <div className="space-y-6 max-w-5xl">
          {/* ---------- Header card: photo + identity ---------- */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-brand-light to-brand-faint p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative shrink-0">
                <div className="h-20 w-20 rounded-2xl bg-white shadow-sm overflow-hidden flex items-center justify-center font-heading text-2xl font-bold text-brand-hover">
                  {profile?.profile_photo ? (
                    <img src={profile.profile_photo} alt="Profile" className="h-full w-full object-cover" />
                  ) : initials}
                </div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-md hover:bg-zinc-800 disabled:opacity-60"
                  data-testid="admin-profile-photo-upload-btn"
                  title="Upload / replace profile photo"
                >
                  {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPhotoChange}
                  data-testid="admin-profile-photo-input"
                />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-xl font-bold text-zinc-900">
                  {profile?.admin_name || user?.name || "Administrator"}
                </h2>
                <p className="text-sm text-zinc-600">
                  {profile?.designation || "Super Admin"} · {profile?.email || user?.email || "—"}
                </p>
                {profile?.profile_photo && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    disabled={photoUploading}
                    className="text-xs text-red-600 hover:underline mt-1 inline-flex items-center gap-1"
                    data-testid="admin-profile-photo-remove"
                  >
                    <Trash2 className="h-3 w-3" /> Remove photo
                  </button>
                )}
              </div>
              <div className="sm:ml-auto flex items-center gap-2">
                <Badge className="bg-brand text-zinc-900 hover:bg-brand-hover">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verified Admin
                </Badge>
                {!editing ? (
                  <Button
                    className="bg-zinc-900 text-white hover:bg-zinc-800 font-semibold"
                    onClick={startEdit}
                    data-testid="admin-profile-edit-btn"
                  >
                    <Pencil className="h-4 w-4 mr-1.5" /> Edit Profile
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={cancelEdit} disabled={saving} data-testid="admin-profile-cancel-btn">
                      <X className="h-4 w-4 mr-1.5" /> Cancel
                    </Button>
                    <Button
                      className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
                      onClick={saveProfile}
                      disabled={saving}
                      data-testid="admin-profile-save-btn"
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---------- Profile Information ---------- */}
          <Section title="Profile Information" icon={UserCog}>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Admin Name"><Input value={form.admin_name} onChange={(e) => setField("admin_name", e.target.value)} data-testid="f-admin_name" /></Field>
                <Field label="Designation"><Input value={form.designation} onChange={(e) => setField("designation", e.target.value)} data-testid="f-designation" /></Field>
                <Field label="Mobile Number"><Input value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} placeholder="10-digit mobile" data-testid="f-mobile" /></Field>
                <Field label="Alternate Mobile Number"><Input value={form.alternate_mobile} onChange={(e) => setField("alternate_mobile", e.target.value)} data-testid="f-alternate_mobile" /></Field>
                <Field label="Email Address"><Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} data-testid="f-email" /></Field>
                <Field label="Date of Birth"><Input type="date" value={form.dob} onChange={(e) => setField("dob", e.target.value)} data-testid="f-dob" /></Field>
                <Field label="Gender">
                  <Select value={form.gender || undefined} onValueChange={(v) => setField("gender", v)}>
                    <SelectTrigger data-testid="f-gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <ReadRow label="Admin Name" value={profile?.admin_name} />
                <ReadRow label="Designation" value={profile?.designation} />
                <ReadRow label="Mobile Number" value={profile?.mobile} />
                <ReadRow label="Alternate Mobile" value={profile?.alternate_mobile} />
                <ReadRow label="Email" value={profile?.email} />
                <ReadRow label="Date of Birth" value={profile?.dob} />
                <ReadRow label="Gender" value={profile?.gender} />
              </div>
            )}
          </Section>

          {/* ---------- Address Information ---------- */}
          <Section title="Address Information">
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Address" full><Textarea value={form.address} onChange={(e) => setField("address", e.target.value)} data-testid="f-address" /></Field>
                <Field label="City"><Input value={form.city} onChange={(e) => setField("city", e.target.value)} data-testid="f-city" /></Field>
                <Field label="State"><Input value={form.state} onChange={(e) => setField("state", e.target.value)} data-testid="f-state" /></Field>
                <Field label="Country"><Input value={form.country} onChange={(e) => setField("country", e.target.value)} data-testid="f-country" /></Field>
                <Field label="Pincode"><Input value={form.pincode} onChange={(e) => setField("pincode", e.target.value)} data-testid="f-pincode" /></Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <ReadRow label="Address" value={profile?.address} />
                <ReadRow label="City" value={profile?.city} />
                <ReadRow label="State" value={profile?.state} />
                <ReadRow label="Country" value={profile?.country} />
                <ReadRow label="Pincode" value={profile?.pincode} />
              </div>
            )}
          </Section>

          {/* ---------- Business / Tax Information ---------- */}
          <Section title="Business / Tax Information">
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Company Name"><Input value={form.company_name} onChange={(e) => setField("company_name", e.target.value)} data-testid="f-company_name" /></Field>
                <Field label="GST Number"><Input value={form.gst_number} onChange={(e) => setField("gst_number", e.target.value.toUpperCase())} data-testid="f-gst_number" /></Field>
                <Field label="PAN Number"><Input value={form.pan_number} onChange={(e) => setField("pan_number", e.target.value.toUpperCase())} data-testid="f-pan_number" /></Field>
                <Field label="TAN Number"><Input value={form.tan_number} onChange={(e) => setField("tan_number", e.target.value.toUpperCase())} data-testid="f-tan_number" /></Field>
                <Field label="CIN Number"><Input value={form.cin_number} onChange={(e) => setField("cin_number", e.target.value.toUpperCase())} data-testid="f-cin_number" /></Field>
                <Field label="Business Address"><Textarea value={form.business_address} onChange={(e) => setField("business_address", e.target.value)} data-testid="f-business_address" /></Field>
                <Field label="Registered Address"><Textarea value={form.registered_address} onChange={(e) => setField("registered_address", e.target.value)} data-testid="f-registered_address" /></Field>
                <Field label="Office Address"><Textarea value={form.office_address} onChange={(e) => setField("office_address", e.target.value)} data-testid="f-office_address" /></Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <ReadRow label="Company Name" value={profile?.company_name} />
                <ReadRow label="GST Number" value={profile?.gst_number} />
                <ReadRow label="PAN Number" value={profile?.pan_number} />
                <ReadRow label="TAN Number" value={profile?.tan_number} />
                <ReadRow label="CIN Number" value={profile?.cin_number} />
                <ReadRow label="Business Address" value={profile?.business_address} />
                <ReadRow label="Registered Address" value={profile?.registered_address} />
                <ReadRow label="Office Address" value={profile?.office_address} />
              </div>
            )}
          </Section>

          {/* ---------- Other Information ---------- */}
          <Section title="Other Information">
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Website"><Input value={form.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://example.com" data-testid="f-website" /></Field>
                <Field label="Alternate Email"><Input type="email" value={form.alternate_email} onChange={(e) => setField("alternate_email", e.target.value)} data-testid="f-alternate_email" /></Field>
                <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} data-testid="f-notes" /></Field>
                <Field label="Description"><Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} data-testid="f-description" /></Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <ReadRow label="Website" value={profile?.website} />
                <ReadRow label="Alternate Email" value={profile?.alternate_email} />
                <ReadRow label="Notes" value={profile?.notes} />
                <ReadRow label="Description" value={profile?.description} />
              </div>
            )}
          </Section>

          {/* ---------- Documents ---------- */}
          <Section title="Documents">
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <Field label="Document Type">
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="w-64" data-testid="admin-doc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                variant="outline"
                onClick={() => docInputRef.current?.click()}
                disabled={docUploading}
                data-testid="admin-doc-upload-btn"
              >
                {docUploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Upload Document
              </Button>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
                className="hidden"
                onChange={onDocFileChange}
                data-testid="admin-doc-input"
              />
              <span className="text-xs text-muted-foreground">PDF, JPEG, PNG, WEBP, DOCX or XLSX — up to 5MB</span>
            </div>

            {docsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
              </div>
            ) : documents.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-zinc-200 rounded-xl">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50">
                    <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{doc.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.file_name || "file"} · {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => downloadDocument(doc)} data-testid={`admin-doc-download-${doc.id}`} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteDocument(doc)} data-testid={`admin-doc-delete-${doc.id}`} title="Delete">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ---------- Custom Fields ---------- */}
          <Section title="Custom Fields" icon={SlidersHorizontal}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground max-w-md">
                Add your own fields for information that isn't part of the standard profile — no developer needed.
              </p>
              <Button
                variant="outline"
                onClick={openAddField}
                data-testid="admin-custom-field-add-btn"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add Custom Field
              </Button>
            </div>

            {fieldsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading custom fields…
              </div>
            ) : customFields.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-zinc-200 rounded-xl flex flex-col items-center gap-2">
                <ListPlus className="h-5 w-5 text-zinc-300" />
                No custom fields yet. Use "+ Add Custom Field" to create one.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                {customFields.map((field) => (
                  <div key={field.id} className="flex items-start gap-3 p-3 hover:bg-zinc-50" data-testid={`admin-custom-field-${field.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-zinc-800 truncate">{field.field_name}</p>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {CUSTOM_FIELD_TYPES.find((t) => t.value === field.field_type)?.label || field.field_type}
                        </Badge>
                        {field.required && (
                          <Badge className="text-[10px] font-normal bg-red-50 text-red-600 hover:bg-red-50">Required</Badge>
                        )}
                      </div>
                      <div className="text-sm text-zinc-600 mt-1 break-all">
                        {field.field_type === "checkbox" ? (
                          field.value ? "Yes" : "No"
                        ) : field.field_type === "file" ? (
                          field.has_value ? (
                            <button
                              type="button"
                              onClick={() => downloadCustomFieldFile(field)}
                              className="inline-flex items-center gap-1 text-brand-hover hover:underline"
                              data-testid={`admin-custom-field-file-${field.id}`}
                            >
                              <FileText className="h-3.5 w-3.5" /> {field.file_name || "Download file"}
                            </button>
                          ) : (
                            <span className="text-zinc-400">No file uploaded</span>
                          )
                        ) : field.has_value ? (
                          field.value
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => openEditField(field)} data-testid={`admin-custom-field-edit-${field.id}`} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setFieldToDelete(field)} data-testid={`admin-custom-field-delete-${field.id}`} title="Delete">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ---------- Add/Edit Custom Field modal ---------- */}
      <Dialog open={fieldModalOpen} onOpenChange={(open) => (open ? setFieldModalOpen(true) : closeFieldModal())}>
        <DialogContent className="sm:max-w-md" data-testid="admin-custom-field-modal">
          <DialogHeader>
            <DialogTitle>{editingFieldId ? "Edit Custom Field" : "Add Custom Field"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Field Name">
              <Input
                value={fieldDraft.field_name}
                onChange={(e) => setFieldDraft((d) => ({ ...d, field_name: e.target.value }))}
                placeholder="e.g. License Number"
                data-testid="admin-custom-field-name-input"
              />
            </Field>
            <Field label="Field Type">
              <Select
                value={fieldDraft.field_type}
                onValueChange={(v) => setFieldDraft((d) => ({ ...emptyCustomFieldDraft(), field_name: d.field_name, required: d.required, field_type: v }))}
              >
                <SelectTrigger data-testid="admin-custom-field-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOM_FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {fieldDraft.field_type === "dropdown" && (
              <Field label="Options (comma separated)">
                <Input
                  value={fieldDraft.optionsText}
                  onChange={(e) => setFieldDraft((d) => ({ ...d, optionsText: e.target.value }))}
                  placeholder="e.g. Anantapur, Hyderabad, Bangalore"
                  data-testid="admin-custom-field-options-input"
                />
              </Field>
            )}

            <Field label="Field Value">
              {fieldDraft.field_type === "textarea" ? (
                <Textarea
                  value={fieldDraft.value}
                  onChange={(e) => setFieldDraft((d) => ({ ...d, value: e.target.value }))}
                  data-testid="admin-custom-field-value-input"
                />
              ) : fieldDraft.field_type === "checkbox" ? (
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={fieldDraft.checkboxValue}
                    onCheckedChange={(v) => setFieldDraft((d) => ({ ...d, checkboxValue: v }))}
                    data-testid="admin-custom-field-value-checkbox"
                  />
                  <span className="text-sm text-zinc-600">{fieldDraft.checkboxValue ? "Yes" : "No"}</span>
                </div>
              ) : fieldDraft.field_type === "dropdown" ? (
                <Select
                  value={fieldDraft.value || undefined}
                  onValueChange={(v) => setFieldDraft((d) => ({ ...d, value: v }))}
                >
                  <SelectTrigger data-testid="admin-custom-field-value-select"><SelectValue placeholder="Select a value" /></SelectTrigger>
                  <SelectContent>
                    {fieldDraft.optionsText.split(",").map((o) => o.trim()).filter(Boolean).map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : fieldDraft.field_type === "file" ? (
                <div>
                  <Button variant="outline" onClick={() => customFileInputRef.current?.click()} data-testid="admin-custom-field-value-file-btn">
                    <Upload className="h-4 w-4 mr-1.5" /> {fieldDraft.fileName ? "Replace file" : "Choose file"}
                  </Button>
                  {fieldDraft.fileName && <p className="text-xs text-muted-foreground mt-1.5">{fieldDraft.fileName}</p>}
                  <input
                    ref={customFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
                    className="hidden"
                    onChange={onCustomFileChange}
                    data-testid="admin-custom-field-value-file-input"
                  />
                </div>
              ) : (
                <Input
                  type={fieldDraft.field_type === "date" ? "date" : fieldDraft.field_type === "number" ? "number" : "text"}
                  value={fieldDraft.value}
                  onChange={(e) => setFieldDraft((d) => ({ ...d, value: e.target.value }))}
                  placeholder={fieldDraft.field_type === "phone" ? "10-digit mobile" : fieldDraft.field_type === "url" ? "https://example.com" : undefined}
                  data-testid="admin-custom-field-value-input"
                />
              )}
            </Field>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-zinc-800">Required</p>
                <p className="text-xs text-muted-foreground">A value must be provided for this field</p>
              </div>
              <Switch
                checked={fieldDraft.required}
                onCheckedChange={(v) => setFieldDraft((d) => ({ ...d, required: v }))}
                data-testid="admin-custom-field-required-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFieldModal} disabled={fieldSaving}>Cancel</Button>
            <Button
              className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
              onClick={saveCustomField}
              disabled={fieldSaving}
              data-testid="admin-custom-field-save-btn"
            >
              {fieldSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Delete Custom Field confirmation ---------- */}
      <AlertDialog open={!!fieldToDelete} onOpenChange={(open) => !open && setFieldToDelete(null)}>
        <AlertDialogContent data-testid="admin-custom-field-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this custom field?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fieldToDelete?.field_name}"? This only removes this field —
              the rest of your profile is unaffected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fieldDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteField(); }}
              disabled={fieldDeleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="admin-custom-field-delete-confirm-btn"
            >
              {fieldDeleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-zinc-400" />}
        <h3 className="font-heading text-sm font-bold text-zinc-900 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
