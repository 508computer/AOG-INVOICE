import { useEffect, useState } from "react";
import api from "@/lib/api";
import { CURRENCY_OPTIONS } from "@/lib/format";
import { Trash2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ExchangeRates() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ from_currency: "USD", to_currency: "IDR", rate: "" });

  const load = () => {
    setLoading(true);
    api.get("/exchange-rates").then((r) => setRates(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onSave = async () => {
    if (!form.rate || Number(form.rate) <= 0) return toast.error("Rate must be > 0");
    if (form.from_currency === form.to_currency) return toast.error("From and To must differ");
    try {
      await api.post("/exchange-rates", { ...form, rate: Number(form.rate) });
      toast.success("Rate saved");
      setForm({ ...form, rate: "" });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    }
  };

  const onDelete = async (r) => {
    if (!window.confirm(`Delete rate ${r.from_currency} → ${r.to_currency}?`)) return;
    try {
      await api.delete(`/exchange-rates/${r.id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div data-testid="rates-page" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <div className="font-display font-bold text-sm text-slate-900">Manual Exchange Rates</div>
            <div className="text-xs text-slate-500">User-defined rates for invoice currency conversion</div>
          </div>
          <button onClick={load} className="text-xs text-slate-500 hover:text-[#0B1E36] inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["From", "To", "Rate", "Updated", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>}
            {rates.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-mono font-bold text-slate-900">{r.from_currency}</td>
                <td className="px-4 py-3 text-sm font-mono font-bold text-slate-900">{r.to_currency}</td>
                <td className="px-4 py-3 text-sm tabular-nums font-semibold">
                  1 {r.from_currency} = <span className="text-amber-600">{r.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span> {r.to_currency}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.updated_at?.slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-3">
                  <button onClick={() => onDelete(r)} data-testid={`delete-rate-${r.from_currency}-${r.to_currency}`} className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-sm">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm p-5 h-fit">
        <div className="font-display font-bold text-sm text-slate-900 mb-4">Add / Update Rate</div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">From Currency</label>
            <select data-testid="rate-from" value={form.from_currency} onChange={(e) => setForm({ ...form, from_currency: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1E36]">
              {CURRENCY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">To Currency</label>
            <select data-testid="rate-to" value={form.to_currency} onChange={(e) => setForm({ ...form, to_currency: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1E36]">
              {CURRENCY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">
              Rate (1 {form.from_currency} = ? {form.to_currency})
            </label>
            <input
              data-testid="rate-value"
              type="number"
              step="0.0001"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              placeholder="e.g., 16500"
              className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>
          <button data-testid="rate-save" onClick={onSave} className="w-full px-3 py-2 bg-[#0B1E36] text-white text-sm font-semibold rounded-sm hover:bg-[#0F294D] inline-flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> Save Rate
          </button>
        </div>
      </div>
    </div>
  );
}
