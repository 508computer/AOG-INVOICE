import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { fileUrl } from "@/lib/api";
import { Printer, Download, Edit2, ArrowLeft } from "lucide-react";
import { formatMoney, formatDate, statusBadge } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [inv, comp] = await Promise.all([
          api.get(`/invoices/${id}`),
          api.get("/company-settings"),
        ]);
        setInvoice(inv.data);
        setCompany(comp.data);
        const c = await api.get("/clients");
        setClient(c.data.find((x) => x.id === inv.data.client_id));
      } catch {
        toast.error("Failed to load invoice");
      }
    })();
  }, [id]);

  const onDownload = async () => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoice_number.replace(/\//g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const onPrint = async () => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const win = window.open(url, "_blank");
      if (win) {
        win.addEventListener("load", () => win.print());
      }
    } catch {
      toast.error("Print failed");
    }
  };

  if (!invoice || !company) return <div className="text-sm text-slate-500">Loading…</div>;

  const total = invoice.total_currency;

  return (
    <div data-testid="invoice-view-page" className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <button
          data-testid="back-button"
          onClick={() => navigate("/invoices")}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#0B1E36]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to invoices
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="view-print"
            onClick={onPrint}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-sm font-semibold rounded-sm hover:bg-slate-50"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            data-testid="view-download"
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          {isAdmin && (
            <button
              data-testid="view-edit"
              onClick={() => navigate(`/invoices/${id}/edit`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B1E36] hover:bg-[#0F294D] text-white text-sm font-semibold rounded-sm"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Invoice preview */}
      <div className="bg-white max-w-4xl mx-auto p-8 md:p-12 shadow-lg border border-slate-200 rounded-sm print-page">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-[#0B1E36] pb-6 mb-6">
          <div className="flex items-start gap-4">
            {company.logo_url && (
              <img
                src={fileUrl(company.logo_url)}
                alt="logo"
                className="w-20 h-20 object-contain"
              />
            )}
            <div>
              <div className="font-display text-lg font-black text-[#0B1E36] tracking-tight">
                {company.company_name}
              </div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                {company.address}
                {company.phone && <div>Phone: {company.phone}</div>}
                {company.email && <div>Email: {company.email}</div>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl font-black text-[#0B1E36] tracking-tighter">INVOICE</div>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wider font-bold border ${statusBadge(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1.5">TO</div>
            <div className="font-bold text-slate-900">{client?.company_name}</div>
            {(invoice.attention || client?.contact_person) && (
              <div className="text-sm text-slate-700">Attn: {invoice.attention || client?.contact_person}</div>
            )}
            {client?.address && <div className="text-sm text-slate-700">{client.address}</div>}
            {client?.country && <div className="text-sm text-slate-700">{client.country}</div>}
            {client?.phone && <div className="text-sm text-slate-500">{client.phone}</div>}
            {client?.email && <div className="text-sm text-slate-500">{client.email}</div>}
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 w-32">Invoice #</div>
              <div className="font-mono font-bold text-[#0B1E36]">{invoice.invoice_number}</div>
            </div>
            <div className="flex">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 w-32">Date</div>
              <div className="font-semibold">{formatDate(invoice.invoice_date)}</div>
            </div>
            {invoice.due_date && (
              <div className="flex">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 w-32">Due Date</div>
                <div className="font-semibold">{formatDate(invoice.due_date)}</div>
              </div>
            )}
            {invoice.vessel && (
              <div className="flex">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 w-32">Vessel</div>
                <div>{invoice.vessel}</div>
              </div>
            )}
            {invoice.voyage && (
              <div className="flex">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 w-32">Voyage</div>
                <div>{invoice.voyage}</div>
              </div>
            )}
            {invoice.port && (
              <div className="flex">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 w-32">Port</div>
                <div>{invoice.port}</div>
              </div>
            )}
          </div>
        </div>

        {invoice.remarks && (
          <div className="mb-6 text-sm">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mr-3">REMARKS:</span>
            <span className="text-slate-700">{invoice.remarks}</span>
          </div>
        )}

        {/* Item table */}
        <table className="w-full border border-[#0B1E36] mb-6">
          <thead>
            <tr className="bg-[#0B1E36] text-white">
              {["NO", "DESCRIPTION", "RANK", "DATE", "QTY", "PRICE", "AMOUNT"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left border-r border-slate-700 last:border-r-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => (
              <tr key={idx} className="border-b border-slate-200 last:border-b-0 even:bg-slate-50">
                <td className="px-3 py-2.5 text-sm text-center border-r border-slate-200">{idx + 1}</td>
                <td className="px-3 py-2.5 text-sm border-r border-slate-200">{it.description}</td>
                <td className="px-3 py-2.5 text-sm text-center border-r border-slate-200">{it.rank}</td>
                <td className="px-3 py-2.5 text-sm text-center border-r border-slate-200">{it.date}</td>
                <td className="px-3 py-2.5 text-sm text-center border-r border-slate-200 tabular-nums">{it.quantity}</td>
                <td className="px-3 py-2.5 text-sm text-right border-r border-slate-200 tabular-nums">
                  {formatMoney(it.price, it.currency)}
                </td>
                <td className="px-3 py-2.5 text-sm text-right tabular-nums font-semibold">
                  {formatMoney((Number(it.quantity) || 0) * (Number(it.price) || 0), it.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bottom: bank info + totals */}
        <div className="grid grid-cols-5 gap-8 mb-12">
          <div className="col-span-3">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#0B1E36] mb-2">PAYMENT INFORMATION</div>
            <div className="text-xs space-y-1 leading-relaxed">
              <div><span className="font-semibold w-32 inline-block">Beneficiary</span>: {company.bank?.beneficiary}</div>
              <div><span className="font-semibold w-32 inline-block">Bank Name</span>: {company.bank?.bank_name}</div>
              <div><span className="font-semibold w-32 inline-block">Acc. Number</span>: <span className="font-mono">{company.bank?.account_number}</span></div>
              <div><span className="font-semibold w-32 inline-block">Swift Code</span>: <span className="font-mono">{company.bank?.swift_code}</span></div>
              <div><span className="font-semibold w-32 inline-block">Address</span>: {company.bank?.address}</div>
              <div><span className="font-semibold w-32 inline-block">Country</span>: {company.bank?.country}</div>
            </div>
          </div>
          <div className="col-span-2 space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="text-slate-500">Subtotal</span>
              <span className="tabular-nums font-semibold">{formatMoney(invoice.subtotal, total)}</span>
            </div>
            {invoice.tax_percent ? (
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500">Tax ({invoice.tax_percent}%)</span>
                <span className="tabular-nums">{formatMoney(invoice.tax_amount, total)}</span>
              </div>
            ) : null}
            {invoice.discount_amount ? (
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500">Discount</span>
                <span className="tabular-nums">- {formatMoney(invoice.discount_amount, total)}</span>
              </div>
            ) : null}
            <div className="bg-[#0B1E36] text-white p-3 mt-3 rounded-sm flex justify-between items-baseline">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Grand Total</div>
                <div className="text-[10px] text-slate-300">in {total}</div>
              </div>
              <div className="font-display font-black text-2xl tabular-nums">
                {formatMoney(invoice.grand_total, total)}
              </div>
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="flex justify-end">
          <div className="text-center w-56">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-12">
              Authorized Signature
            </div>
            <div className="border-t border-slate-900 pt-2">
              <div className="font-bold text-slate-900">{company.signature_name}</div>
              <div className="text-xs text-slate-500">{company.signature_title}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
