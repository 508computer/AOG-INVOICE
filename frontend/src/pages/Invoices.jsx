import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Plus, Search, Eye, Edit2, Printer, Trash2 } from "lucide-react";
import { formatMoney, formatDate, statusBadge } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Invoices() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = () => {
    setLoading(true);
    api
      .get("/invoices")
      .then((res) => setInvoices(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onDelete = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    try {
      await api.delete(`/invoices/${inv.id}`);
      toast.success("Invoice deleted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete");
    }
  };

  const onPrintPdf = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const win = window.open(url, "_blank");
      if (win) {
        win.addEventListener("load", () => win.print());
      }
    } catch {
      toast.error("Failed to load PDF");
    }
  };

  const filtered = invoices.filter((inv) => {
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.client_name?.toLowerCase().includes(q) ||
      inv.vessel?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div data-testid="invoices-page" className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="invoices-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, client, vessel…"
            className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
          />
        </div>
        <select
          data-testid="invoices-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36] bg-white"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          data-testid="invoices-new-button"
          onClick={() => navigate("/invoices/new")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B1E36] text-white text-sm font-semibold rounded-sm hover:bg-[#0F294D]"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Invoice #", "Client", "Date", "Currency", "Total", "Status", "Created By", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                    No invoices found.
                  </td>
                </tr>
              )}
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-mono text-[#0B1E36] font-semibold">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-sm text-slate-900">{inv.client_name}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatDate(inv.invoice_date)}</td>
                  <td className="px-5 py-3 text-xs font-mono text-slate-700 font-semibold">{inv.total_currency}</td>
                  <td className="px-5 py-3 text-sm text-slate-900 tabular-nums font-semibold">
                    {formatMoney(inv.grand_total, inv.total_currency)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wider font-bold border ${statusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">@{inv.created_by_name}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        data-testid={`view-${inv.invoice_number}`}
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        title="View"
                        className="p-1.5 text-slate-600 hover:text-[#0B1E36] hover:bg-slate-100 rounded-sm"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        data-testid={`print-${inv.invoice_number}`}
                        onClick={() => onPrintPdf(inv)}
                        title="Print PDF"
                        className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-slate-100 rounded-sm"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            data-testid={`edit-${inv.invoice_number}`}
                            onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                            title="Edit"
                            className="p-1.5 text-slate-600 hover:text-[#0B1E36] hover:bg-slate-100 rounded-sm"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            data-testid={`delete-${inv.invoice_number}`}
                            onClick={() => onDelete(inv)}
                            title="Delete"
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
