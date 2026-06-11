// Common formatting utilities

export const CURRENCY_OPTIONS = ["USD", "IDR", "SGD", "EUR", "MYR", "JPY", "CNY"];

export const CURRENCY_SYMBOLS = {
  USD: "$",
  IDR: "Rp",
  SGD: "S$",
  EUR: "€",
  MYR: "RM",
  JPY: "¥",
  CNY: "¥",
};

export const formatMoney = (amount, currency = "USD") => {
  const num = Number(amount) || 0;
  const sym = CURRENCY_SYMBOLS[currency] || currency + " ";
  if (currency === "IDR" || currency === "JPY") {
    return `${sym} ${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `${sym} ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

export const statusBadge = (status) => {
  const map = {
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    overdue: "bg-red-100 text-red-800 border-red-200",
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return map[status] || map.pending;
};
