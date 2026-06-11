import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { Plus, Trash2, Save, X } from "lucide-react";
import { CURRENCY_OPTIONS, formatMoney } from "@/lib/format";
import { toast } from "sonner";

const EMPTY_ITEM = () => ({
  description: "",
  rank: "",
  date: "",
  quantity: 1,
  unit: "",
  currency: "USD",
  price: 0,
});

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [clients, setClients] = useState([]);
  const [serverRates, setServerRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    client_id: "",
    invoice_date: today,
    due_date: "",
    attention: "",
    vessel: "",
    voyage: "",
    port: "",
    remarks: "",
    items: [EMPTY_ITEM()],
    total_currency: "USD",
    tax_percent: 0,
    discount_amount: 0,
    status: "pending",
    exchange_rates: { USD: 1 },
  });

  // Load resources
  useEffect(() => {
    (async () => {
      try {
        const [cli, rates] = await Promise.all([
          api.get("/clients"),
          api.get("/exchange-rates"),
        ]);
        setClients(cli.data);
        setServerRates(rates.data);

        if (isEdit) {
          const { data } = await api.get(`/invoices/${id}`);
          setForm({
            client_id: data.client_id,
            invoice_date: (data.invoice_date || today).slice(0, 10),
            due_date: data.due_date?.slice(0, 10) || "",
            attention: data.attention || "",
            vessel: data.vessel || "",
            voyage: data.voyage || "",
            port: data.port || "",
            remarks: data.remarks || "",
            items: data.items?.length ? data.items : [EMPTY_ITEM()],
            total_currency: data.total_currency || "USD",
            tax_percent: data.tax_percent || 0,
            discount_amount: data.discount_amount || 0,
            status: data.status || "pending",
            exchange_rates: data.exchange_rates || { [data.total_currency || "USD"]: 1 },
          });
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Ensure exchange_rates has entries for total_currency and all item currencies
  useEffect(() => {
    const total = form.total_currency.toUpperCase();
    const needed = new Set([total]);
    form.items.forEach((it) => needed.add((it.currency || "USD").toUpperCase()));

    setForm((prev) => {
      const rates = { ...prev.exchange_rates };
      rates[total] = 1;
      needed.forEach((cur) => {
        if (!(cur in rates)) {
          // look up from serverRates: rate from cur -> total
          const direct = serverRates.find(
            (r) => r.from_currency === cur && r.to_currency === total
          );
          if (direct) {
            rates[cur] = direct.rate;
          } else {
            // try inverse via IDR pivot or just default 1
            const curToIdr = serverRates.find(
              (r) => r.from_currency === cur && r.to_currency === "IDR"
            );
            const totalToIdr = serverRates.find(
              (r) => r.from_currency === total && r.to_currency === "IDR"
            );
            if (curToIdr && totalToIdr && totalToIdr.rate) {
              rates[cur] = curToIdr.rate / totalToIdr.rate;
            } else {
              rates[cur] = cur === total ? 1 : 1;
            }
          }
        }
      });
      return { ...prev, exchange_rates: rates };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.total_currency, JSON.stringify(form.items.map((i) => i.currency)), serverRates]);

  // Computed totals
  const computed = useMemo(() => {
    const total = form.total_currency.toUpperCase();
    // Per-currency subtotals (in each item's native currency)
    const byCurrency = {};
    form.items.forEach((it) => {
      const cur = (it.currency || "USD").toUpperCase();
      const amount = (Number(it.quantity) || 0) * (Number(it.price) || 0);
      byCurrency[cur] = (byCurrency[cur] || 0) + amount;
    });
    // Converted subtotal in total_currency
    let subtotal = 0;
    Object.entries(byCurrency).forEach(([cur, amt]) => {
      if (cur === total) {
        subtotal += amt;
      } else {
        const r = Number(form.exchange_rates[cur]) || 0;
        subtotal += amt * r;
      }
    });
    const tax = (subtotal * (Number(form.tax_percent) || 0)) / 100;
    const grand = subtotal + tax - (Number(form.discount_amount) || 0);
    return { subtotal, tax, grand, byCurrency };
  }, [form]);

  const setItem = (idx, key, val) => {
    setForm((prev) => {
      const items = prev.items.slice();
      items[idx] = { ...items[idx], [key]: val };
      return { ...prev, items };
    });
  };

  const addItem = () =>
    setForm((prev) => ({ ...prev, items: [...prev.items, EMPTY_ITEM()] }));

  const removeItem = (idx) =>
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const setRate = (cur, val) => {
    setForm((prev) => ({ ...prev, exchange_rates: { ...prev.exchange_rates, [cur]: Number(val) || 0 } }));
  };

  const onSave = async () => {
    if (!form.client_id) return toast.error("Please select a client");
    if (!form.items.length) return toast.error("Add at least one line item");
    const invalid = form.items.findIndex((it) => !it.description.trim());
    if (invalid >= 0) return toast.error(`Item #${invalid + 1} is missing description`);

    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity) || 0,
          price: Number(it.price) || 0,
        })),
        tax_percent: Number(form.tax_percent) || 0,
        discount_amount: Number(form.discount_amount) || 0,
      };
      let res;
      if (isEdit) {
        res = await api.put(`/invoices/${id}`, payload);
        toast.success("Invoice updated");
      } else {
        res = await api.post("/invoices", payload);
        toast.success(`Invoice ${res.data.invoice_number} created`);
      }
      navigate(`/invoices/${res.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;

  // Unique currencies used (for exchange rate panel)
  const usedCurrencies = Array.from(
    new Set([form.total_currency, ...form.items.map((it) => it.currency || "USD")])
  );

  return (
    <div data-testid="invoice-form-page" className="space-y-6">
      {/* Header section */}
      <section className="bg-white border border-slate-200 rounded-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Client *</label>
            <select
              data-testid="form-client"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            >
              <option value="">-- Select Client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} ({c.initial})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Status</label>
            <select
              data-testid="form-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Invoice Date *</label>
            <input
              data-testid="form-invoice-date"
              type="date"
              value={form.invoice_date}
              onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Due Date</label>
            <input
              data-testid="form-due-date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Attention</label>
            <input
              data-testid="form-attention"
              type="text"
              value={form.attention}
              onChange={(e) => setForm({ ...form, attention: e.target.value })}
              placeholder="e.g., Mrs. Yuni"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Vessel</label>
            <input
              data-testid="form-vessel"
              type="text"
              value={form.vessel}
              onChange={(e) => setForm({ ...form, vessel: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Voyage</label>
            <input
              data-testid="form-voyage"
              type="text"
              value={form.voyage}
              onChange={(e) => setForm({ ...form, voyage: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Port</label>
            <input
              data-testid="form-port"
              type="text"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">Remarks</label>
            <input
              data-testid="form-remarks"
              type="text"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>
        </div>
      </section>

      {/* Line items */}
      <section className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h3 className="font-display font-bold text-sm text-slate-900">Line Items</h3>
          <button
            data-testid="add-item-button"
            onClick={addItem}
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B1E36] hover:text-amber-600"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold w-10">#</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Description</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Rank</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Date</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold w-20">Qty</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold w-24">Currency</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold text-right">Price</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold text-right">Amount</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, idx) => {
                const amt = (Number(it.quantity) || 0) * (Number(it.price) || 0);
                return (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-sm text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <input
                        data-testid={`item-desc-${idx}`}
                        value={it.description}
                        onChange={(e) => setItem(idx, "description", e.target.value)}
                        placeholder="Service or item description"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-testid={`item-rank-${idx}`}
                        value={it.rank}
                        onChange={(e) => setItem(idx, "rank", e.target.value)}
                        className="w-24 px-2 py-1.5 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-testid={`item-date-${idx}`}
                        value={it.date}
                        onChange={(e) => setItem(idx, "date", e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className="w-32 px-2 py-1.5 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-testid={`item-qty-${idx}`}
                        type="number"
                        value={it.quantity}
                        onChange={(e) => setItem(idx, "quantity", e.target.value)}
                        step="0.01"
                        className="w-20 px-2 py-1.5 border border-slate-200 rounded-sm text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        data-testid={`item-currency-${idx}`}
                        value={it.currency}
                        onChange={(e) => setItem(idx, "currency", e.target.value)}
                        className="w-24 px-2 py-1.5 border border-slate-200 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                      >
                        {CURRENCY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-testid={`item-price-${idx}`}
                        type="number"
                        value={it.price}
                        onChange={(e) => setItem(idx, "price", e.target.value)}
                        step="0.01"
                        className="w-28 px-2 py-1.5 border border-slate-200 rounded-sm text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums font-semibold text-slate-900">
                      {formatMoney(amt, it.currency)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {form.items.length > 1 && (
                        <button
                          data-testid={`remove-item-${idx}`}
                          onClick={() => removeItem(idx)}
                          type="button"
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Exchange rate panel + totals */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exchange rates */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-slate-900">Exchange Rates</h3>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">
              1 unit = how many {form.total_currency}?
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {usedCurrencies.map((cur) => (
              <div key={cur} className="flex items-center gap-3">
                <div className="text-xs font-mono font-bold text-slate-700 w-12 tabular-nums">{cur}</div>
                <div className="text-xs text-slate-400">→</div>
                <input
                  data-testid={`rate-${cur}`}
                  type="number"
                  step="0.0001"
                  value={form.exchange_rates[cur] ?? 1}
                  onChange={(e) => setRate(cur, e.target.value)}
                  disabled={cur === form.total_currency}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-sm text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B1E36] disabled:bg-slate-50 disabled:text-slate-400"
                />
                <div className="text-xs text-slate-500 font-mono w-12">{form.total_currency}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <h3 className="font-display font-bold text-sm text-slate-900 mb-4">Totals</h3>

          <div className="space-y-2 text-sm">
            {/* Subtotal breakdown per currency */}
            <div>
              <div className="text-slate-500 mb-1.5">Subtotal</div>
              <div data-testid="subtotal-breakdown" className="space-y-1 pl-2 border-l-2 border-slate-200">
                {Object.entries(computed.byCurrency).length === 0 && (
                  <div className="text-xs text-slate-400">No items yet</div>
                )}
                {Object.entries(computed.byCurrency).map(([cur, amt]) => (
                  <div key={cur} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-slate-600">{cur}</span>
                    <span className="tabular-nums font-semibold text-slate-900">
                      {formatMoney(amt, cur)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-2 mt-3">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">
                Grand Total Currency
              </label>
              <select
                data-testid="form-total-currency"
                value={form.total_currency}
                onChange={(e) => setForm({ ...form, total_currency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1E36] mb-2"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Converted Subtotal</span>
              <span className="tabular-nums font-semibold text-slate-900">
                {formatMoney(computed.subtotal, form.total_currency)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Tax (%)</span>
                <input
                  data-testid="form-tax"
                  type="number"
                  step="0.01"
                  value={form.tax_percent}
                  onChange={(e) => setForm({ ...form, tax_percent: e.target.value })}
                  className="w-16 px-2 py-1 border border-slate-200 rounded-sm text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                />
              </div>
              <span className="tabular-nums">{formatMoney(computed.tax, form.total_currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Discount</span>
              <input
                data-testid="form-discount"
                type="number"
                step="0.01"
                value={form.discount_amount}
                onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                className="w-28 px-2 py-1 border border-slate-200 rounded-sm text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
              />
            </div>
            <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-baseline">
              <div>
                <div className="font-display font-bold text-slate-900">GRAND TOTAL</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">in {form.total_currency}</div>
              </div>
              <span data-testid="form-grand-total" className="font-display font-black text-xl text-[#0B1E36] tabular-nums">
                {formatMoney(computed.grand, form.total_currency)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          data-testid="form-cancel"
          onClick={() => navigate("/invoices")}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-sm hover:bg-slate-50"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          data-testid="form-save"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B1E36] hover:bg-[#0F294D] disabled:opacity-60 text-white text-sm font-semibold rounded-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : isEdit ? "Update Invoice" : "Create Invoice"}
        </button>
      </div>
    </div>
  );
}
