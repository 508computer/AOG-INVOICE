import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  Settings,
  TrendingUp,
  LogOut,
  Anchor,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/invoices", label: "Invoices", icon: FileText, testid: "nav-invoices" },
  { to: "/clients", label: "Clients", icon: Briefcase, testid: "nav-clients" },
  { to: "/users", label: "Users", icon: Users, adminOnly: true, testid: "nav-users" },
  { to: "/exchange-rates", label: "Exchange Rates", icon: TrendingUp, adminOnly: true, testid: "nav-rates" },
  { to: "/settings", label: "Settings", icon: Settings, adminOnly: true, testid: "nav-settings" },
];

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside
      data-testid="sidebar"
      className="w-64 h-full bg-[#0B1E36] flex-shrink-0 flex flex-col text-slate-300 border-r border-slate-800 hidden md:flex"
    >
      {/* Brand */}
      <div
        className="px-5 py-5 border-b border-slate-800/70 cursor-pointer"
        onClick={() => navigate("/dashboard")}
        data-testid="sidebar-brand"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 flex items-center justify-center rounded-sm">
            <Anchor className="w-5 h-5 text-[#0B1E36]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display font-black text-white text-sm leading-tight tracking-tight">
              ARRAZZAQ
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">
              Ocean Global
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-4 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "sidebar-item-active" : ""}`
              }
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-slate-800/70 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-sm bg-slate-700 flex items-center justify-center text-white text-sm font-semibold uppercase">
            {user?.full_name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate font-medium">{user?.full_name}</div>
            <div className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold">
              {user?.role}
            </div>
          </div>
        </div>
        <button
          data-testid="logout-button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-sm border border-slate-800 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
