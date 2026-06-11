import { useLocation, useNavigate } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

const TITLES = {
  "/dashboard": "Dashboard",
  "/invoices": "Invoices",
  "/invoices/new": "Create Invoice",
  "/clients": "Clients",
  "/users": "User Management",
  "/exchange-rates": "Exchange Rates",
  "/settings": "Company Settings",
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  let title = TITLES[location.pathname] || "Dashboard";
  if (location.pathname.startsWith("/invoices/") && location.pathname.endsWith("/edit")) {
    title = "Edit Invoice";
  } else if (location.pathname.match(/^\/invoices\/[^/]+$/)) {
    title = "Invoice Detail";
  }

  return (
    <header
      data-testid="topbar"
      className="h-16 flex items-center justify-between px-6 lg:px-8 bg-white border-b border-slate-200 sticky top-0 z-20"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold hidden sm:inline">
          PT. Arrazzaq Ocean Global
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
        <h1 className="font-display font-bold text-lg text-slate-900 tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {location.pathname === "/invoices" || location.pathname === "/dashboard" ? (
          <button
            data-testid="topbar-new-invoice"
            onClick={() => navigate("/invoices/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B1E36] text-white text-sm font-medium rounded-sm hover:bg-[#0F294D] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Invoice</span>
          </button>
        ) : null}
        <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="text-right">
            <div className="text-xs text-slate-500">Signed in as</div>
            <div className="text-sm font-semibold text-slate-900">@{user?.username}</div>
          </div>
          <div className="w-9 h-9 rounded-sm bg-[#0B1E36] flex items-center justify-center text-white text-sm font-semibold uppercase">
            {user?.full_name?.[0] || "U"}
          </div>
        </div>
      </div>
    </header>
  );
}
