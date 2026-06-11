import { useEffect, useState } from "react";
import api, { fileUrl } from "@/lib/api";
import { Save, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/company-settings").then((r) => setForm(r.data));
  }, []);

  if (!form) return <div className="text-sm text-slate-500">Loading…</div>;

  const set = (k, v) => setForm({ ...form, [k]: v });
  const setBank = (k, v) => setForm({ ...form, bank: { ...form.bank, [k]: v } });

  const onSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/company-settings", form);
      setForm(data);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/uploads/logo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({ ...form, logo_url: data.url });
      toast.success("Logo uploaded — click Save to persist");
    } catch {
      toast.error("Upload failed");
    }
  };

  return (
    <div data-testid="settings-page" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Company info */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-slate-200 rounded-sm p-6">
          <div className="font-display font-bold text-base text-slate-900 mb-1">Company Information</div>
          <div className="text-xs text-slate-500 mb-5">Used on invoices and PDF headers</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" value={form.company_name} onChange={(v) => set("company_name", v)} testid="company-name" />
            <Field label="Default Currency" value={form.default_currency} onChange={(v) => set("default_currency", v)} testid="default-currency" />
            <Field label="Address" value={form.address} onChange={(v) => set("address", v)} testid="company-address" full />
            <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} testid="company-phone" />
            <Field label="Email" value={form.email} onChange={(v) => set("email", v)} testid="company-email" />
            <Field label="Website" value={form.website} onChange={(v) => set("website", v)} testid="company-website" />
            <Field label="Signature Name" value={form.signature_name} onChange={(v) => set("signature_name", v)} testid="signature-name" />
            <Field label="Signature Title" value={form.signature_title} onChange={(v) => set("signature_title", v)} testid="signature-title" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-6">
          <div className="font-display font-bold text-base text-slate-900 mb-1">Bank Information</div>
          <div className="text-xs text-slate-500 mb-5">Payment details printed on every invoice</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Beneficiary" value={form.bank?.beneficiary} onChange={(v) => setBank("beneficiary", v)} testid="bank-beneficiary" full />
            <Field label="Bank Name" value={form.bank?.bank_name} onChange={(v) => setBank("bank_name", v)} testid="bank-name" />
            <Field label="Account Number" value={form.bank?.account_number} onChange={(v) => setBank("account_number", v)} testid="bank-account" mono />
            <Field label="Swift Code" value={form.bank?.swift_code} onChange={(v) => setBank("swift_code", v)} testid="bank-swift" mono />
            <Field label="Address" value={form.bank?.address} onChange={(v) => setBank("address", v)} testid="bank-address" />
            <Field label="Country" value={form.bank?.country} onChange={(v) => setBank("country", v)} testid="bank-country" />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            data-testid="settings-save"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B1E36] hover:bg-[#0F294D] disabled:opacity-60 text-white text-sm font-semibold rounded-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Logo */}
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-sm p-6">
          <div className="font-display font-bold text-base text-slate-900 mb-1">Company Logo</div>
          <div className="text-xs text-slate-500 mb-4">Appears on login, dashboard & PDF</div>
          <div className="border-2 border-dashed border-slate-300 rounded-sm p-6 flex flex-col items-center justify-center bg-slate-50">
            {form.logo_url ? (
              <img src={fileUrl(form.logo_url)} alt="logo" className="max-w-full max-h-48 object-contain mb-4" />
            ) : (
              <div className="text-sm text-slate-400 mb-4">No logo uploaded</div>
            )}
            <label
              data-testid="logo-upload-label"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-sm cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Choose file
              <input data-testid="logo-upload-input" type="file" className="hidden" accept="image/*" onChange={onLogoUpload} />
            </label>
            <div className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">PNG, JPG, SVG · max 5MB</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, testid, full, mono }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">{label}</label>
      <input
        data-testid={testid}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36] ${mono ? "font-mono tabular-nums" : ""}`}
      />
    </div>
  );
}
