import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { FileText, Users, Wallet, Clock, ArrowUpRight, Plus, Briefcase } from "lucide-react";
import { formatMoney, formatDate, statusBadge } from "@/lib/format";
import { useAuth } from "@/lib/auth";

function KpiCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`} className="ridge-top bg-white border border-slate-200 rounded-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{label}</div>
        <div className={`w-9 h-9 ${accent || "bg-slate-100"} rounded-sm flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-slate-700" />
        </div>
      </div>
      <div className="font-display text-3xl font-black text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/dashboard/summary"), api.get("/invoices")])
      .then(([s, inv]) => {
        setSummary(s.data);
        setInvoices(inv.data.slice(0, 7));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading dashboard…</div>;
  }

  return (
    <div data-testid="dashboard-page" className="space-y-8">
      {/* KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          icon={FileText}
          label="Total Invoices"
          value={summary?.total_invoices ?? 0}
          sub="All time"
          accent="bg-slate-100"
        />
        <KpiCard
          icon={Users}
          label="Total Clients"
          value={summary?.total_clients ?? 0}
          sub="Active accounts"
          accent="bg-slate-100"
        />
        <KpiCard
          icon={Wallet}
          label="Total Revenue"
          value={formatMoney(summary?.total_revenue_usd ?? 0, "USD")}
          sub="USD equivalent"
          accent="bg-amber-100"
        />
        <KpiCard
          icon={Clock}
          label="Pending Invoices"
          value={summary?.pending_invoices ?? 0}
          sub="Awaiting payment"
          accent="bg-orange-100"
        />
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          data-testid="quick-create-invoice"
          onClick={() => navigate("/invoices/new")}
          className="flex items-center justify-between p-5 bg-[#0B1E36] text-white rounded-sm hover:bg-[#0F294D] transition-colors group"
        >
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mb-1">Quick Action</div>
            <div className="font-display font-bold">Create New Invoice</div>
          </div>
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
        <button
          data-testid="quick-manage-clients"
          onClick={() => navigate("/clients")}
          className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-sm hover:border-[#0B1E36] transition-colors group"
        >
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Manage</div>
            <div className="font-display font-bold text-slate-900">Client Database</div>
          </div>
          <Briefcase className="w-5 h-5 text-slate-700" />
        </button>
        <button
          data-testid="quick-view-invoices"
          onClick={() => navigate("/invoices")}
          className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-sm hover:border-[#0B1E36] transition-colors group"
        >
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Browse</div>
            <div className="font-display font-bold text-slate-900">All Invoices</div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-slate-700" />
        </button>
      </section>

      {/* Recent invoices */}
      <section className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-display font-bold text-base text-slate-900">Recent Invoices</h2>
            <p className="text-xs text-slate-500">Latest activity from your workspace</p>
          </div>
          <button
            data-testid="view-all-invoices"
            onClick={() => navigate("/invoices")}
            className="text-xs uppercase tracking-widest font-bold text-[#0B1E36] hover:text-amber-600 transition-colors"
          >
            View All →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Invoice #</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Client</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Date</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold text-right">Total</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Status</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Created By</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    No invoices yet.{" "}
                    <button onClick={() => navigate("/invoices/new")} className="text-[#0B1E36] underline font-semibold">
                      Create your first invoice
                    </button>
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  data-testid={`recent-invoice-${inv.invoice_number}`}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <td className="px-6 py-3 text-sm font-mono text-[#0B1E36] font-semibold">{inv.invoice_number}</td>
                  <td className="px-6 py-3 text-sm text-slate-900">{inv.client_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{formatDate(inv.invoice_date)}</td>
                  <td className="px-6 py-3 text-sm text-slate-900 text-right tabular-nums font-semibold">
                    {formatMoney(inv.grand_total, inv.total_currency)}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wider font-bold border ${statusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">@{inv.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
