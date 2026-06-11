import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useAuth } from "@/lib/auth";

export default function Layout() {
  const { user } = useAuth();

  if (!user) {
    const hasToken = localStorage.getItem("aog_token");
    if (!hasToken) return <Navigate to="/login" replace />;
    // token exists but user not loaded yet
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <Topbar />
        <main className="flex-1 p-6 lg:p-8 max-w-[1440px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
