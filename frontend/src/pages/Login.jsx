import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Anchor, Lock, User } from "lucide-react";
import { toast } from "sonner";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_ac753fe0-5828-47a8-9e17-f0b9d7689f39/artifacts/4g43cxl1_logo.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }
    setSubmitting(true);
    try {
      await login(username, password, remember);
      toast.success("Welcome back");
      navigate("/dashboard");
    } catch (err) {
      const detail = err?.response?.data?.detail || "Login failed";
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="login-page" className="grid grid-cols-1 md:grid-cols-2 h-screen w-full bg-white">
      {/* Left: form */}
      <div className="flex flex-col justify-between p-8 lg:p-16">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-[#0B1E36] flex items-center justify-center rounded-sm">
              <Anchor className="w-5 h-5 text-amber-500" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-black text-[#0B1E36] text-base leading-tight tracking-tight">
                ARRAZZAQ
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                Ocean Global
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto md:mx-0">
          <div className="mb-1 text-xs uppercase tracking-widest text-amber-600 font-bold">
            Invoice Management System
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight">
            Sign in to your <br /> workspace.
          </h1>
          <p className="text-sm text-slate-500 mb-8">
            Access invoices, clients, and revenue analytics for PT. Arrazzaq Ocean Global.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  data-testid="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36] focus:border-[#0B1E36]"
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  data-testid="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36] focus:border-[#0B1E36]"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                data-testid="login-remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded-sm border-slate-300 text-[#0B1E36] focus:ring-[#0B1E36]"
              />
              Remember me on this device
            </label>

            <button
              data-testid="login-submit"
              type="submit"
              disabled={submitting}
              className="w-full bg-[#0B1E36] hover:bg-[#0F294D] disabled:opacity-60 text-white py-3 rounded-sm text-sm font-semibold tracking-wide transition-colors"
            >
              {submitting ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <div className="mt-8 p-4 border border-dashed border-slate-300 rounded-sm bg-slate-50">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Demo Credentials
            </div>
            <div className="text-xs text-slate-700 font-mono tabular-nums">
              admin / admin123
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 mt-12">
          © {new Date().getFullYear()} PT. Arrazzaq Ocean Global. All rights reserved.
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="hidden md:block relative bg-[#0B1E36] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1594110336951-5bc8c12d6b27?auto=format&fit=crop&w=1600&q=80"
          alt="Container ship at sea"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 login-bg-overlay" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="flex justify-end">
            <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold border border-amber-500 px-3 py-1 rounded-sm">
              Maritime · Logistics · Shipping
            </div>
          </div>

          <div className="max-w-md">
            <img src={LOGO_URL} alt="Arrazzaq Ocean Global" className="w-32 h-32 mb-8 brightness-0 invert opacity-90" />
            <div className="font-display text-4xl xl:text-5xl font-black tracking-tight leading-tight mb-4">
              Navigate revenue with precision.
            </div>
            <p className="text-slate-300 text-base leading-relaxed">
              Multi-currency invoicing built for shipping operations. From quotation to PDF — in one secure workspace.
            </p>
          </div>

          <div className="flex items-end justify-between text-xs text-slate-400">
            <div>
              <div className="uppercase tracking-widest font-bold text-amber-500 mb-1">
                Bank
              </div>
              <div>BRI — Jakarta Sunter</div>
              <div className="font-mono tabular-nums">044102000096506</div>
            </div>
            <div className="text-right">
              <div className="uppercase tracking-widest font-bold text-amber-500 mb-1">
                Swift
              </div>
              <div className="font-mono">BRINIDJAXXX</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
