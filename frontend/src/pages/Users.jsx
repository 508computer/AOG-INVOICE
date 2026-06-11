import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Trash2, Edit2, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  full_name: "",
  username: "",
  email: "",
  phone: "",
  role: "staff",
  is_active: true,
  password: "",
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [resetPwd, setResetPwd] = useState({ user: null, password: "" });

  const load = () => {
    setLoading(true);
    api.get("/users").then((r) => setUsers(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onSave = async () => {
    if (!form.full_name || !form.username || !form.email) {
      return toast.error("Full name, username, email are required");
    }
    if (!editing && !form.password) return toast.error("Password is required for new user");
    try {
      if (editing) {
        const { password, ...rest } = form;
        await api.put(`/users/${editing.id}`, rest);
        toast.success("User updated");
      } else {
        await api.post("/users", form);
        toast.success("User created");
      }
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    }
  };

  const onDelete = async (u) => {
    if (!window.confirm(`Delete user ${u.username}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("User deleted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delete failed");
    }
  };

  const onResetPassword = async () => {
    if (!resetPwd.password || resetPwd.password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    try {
      await api.post(`/users/${resetPwd.user.id}/reset-password`, { password: resetPwd.password });
      toast.success("Password reset");
      setResetPwd({ user: null, password: "" });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Reset failed");
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      toast.success(`User ${!u.is_active ? "activated" : "deactivated"}`);
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div data-testid="users-page" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <div className="font-display font-bold text-sm text-slate-900">All Users</div>
            <div className="text-xs text-slate-500">{users.length} accounts</div>
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Name", "Username", "Email", "Role", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr>}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{u.full_name}</td>
                <td className="px-4 py-3 text-sm font-mono text-slate-700">@{u.username}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wider font-bold border ${u.role === "admin" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    data-testid={`toggle-active-${u.username}`}
                    onClick={() => toggleActive(u)}
                    className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-wider font-bold border ${u.is_active ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-200 text-slate-600 border-slate-300"}`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(u); setForm({ ...u, password: "" }); }} data-testid={`edit-user-${u.username}`} className="p-1.5 text-slate-600 hover:text-[#0B1E36] hover:bg-slate-100 rounded-sm">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setResetPwd({ user: u, password: "" })} data-testid={`reset-pw-${u.username}`} className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-sm">
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(u)} data-testid={`delete-user-${u.username}`} className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="font-display font-bold text-sm text-slate-900 mb-4">
            {editing ? "Edit User" : "Add New User"}
          </div>
          <div className="space-y-3">
            <Input testid="user-full-name" label="Full Name *" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Input testid="user-username" label="Username *" value={form.username} onChange={(v) => setForm({ ...form, username: v })} disabled={!!editing} />
            <Input testid="user-email" label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Input testid="user-phone" label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Role</label>
              <select
                data-testid="user-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {!editing && (
              <Input testid="user-password" label="Password *" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700 pt-1">
              <input
                data-testid="user-active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded-sm border-slate-300 text-[#0B1E36] focus:ring-[#0B1E36]"
              />
              Active account
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button data-testid="user-save" onClick={onSave} className="flex-1 px-3 py-2 bg-[#0B1E36] text-white text-sm font-semibold rounded-sm hover:bg-[#0F294D]">
              <Plus className="w-4 h-4 inline mr-1" />
              {editing ? "Update" : "Create User"}
            </button>
            {editing && (
              <button onClick={() => { setEditing(null); setForm(EMPTY); }} className="px-3 py-2 border border-slate-300 text-sm rounded-sm hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>
        </div>

        {resetPwd.user && (
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-5">
            <div className="font-display font-bold text-sm text-amber-900 mb-3">
              Reset password for @{resetPwd.user.username}
            </div>
            <input
              data-testid="reset-password-input"
              type="password"
              value={resetPwd.password}
              onChange={(e) => setResetPwd({ ...resetPwd, password: e.target.value })}
              placeholder="New password (min 6 chars)"
              className="w-full px-3 py-2 border border-amber-300 rounded-sm text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-2">
              <button data-testid="reset-password-confirm" onClick={onResetPassword} className="flex-1 px-3 py-2 bg-amber-500 text-white text-sm font-semibold rounded-sm hover:bg-amber-600">
                Reset Password
              </button>
              <button onClick={() => setResetPwd({ user: null, password: "" })} className="px-3 py-2 border border-amber-300 text-sm rounded-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", disabled, testid }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">{label}</label>
      <input
        data-testid={testid}
        type={type}
        disabled={disabled}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36] disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
}
