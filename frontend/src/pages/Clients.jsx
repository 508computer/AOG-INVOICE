import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const EMPTY = {
  company_name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  country: "",
  initial: "",
};

export default function Clients() {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => {
    setLoading(true);
    api.get("/clients").then((r) => setClients(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onSave = async () => {
    if (!form.company_name.trim()) return toast.error("Company name is required");
    try {
      if (editing) {
        await api.put(`/clients/${editing.id}`, form);
        toast.success("Client updated");
      } else {
        await api.post("/clients", form);
        toast.success("Client created");
      }
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    }
  };

  const onEdit = (c) => {
    setEditing(c);
    setForm({ ...c });
  };

  const onDelete = async (c) => {
    if (!window.confirm(`Delete client ${c.company_name}?`)) return;
    try {
      await api.delete(`/clients/${c.id}`);
      toast.success("Client deleted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delete failed");
    }
  };

  const filtered = clients.filter((c) =>
    [c.company_name, c.contact_person, c.country, c.initial]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div data-testid="clients-page" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* List */}
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="client-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Initial", "Company", "Contact", "Country", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No clients yet.</td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-mono font-bold text-amber-600">{c.initial}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{c.company_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {c.contact_person}
                    {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.country}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        data-testid={`edit-client-${c.id}`}
                        onClick={() => onEdit(c)}
                        className="p-1.5 text-slate-600 hover:text-[#0B1E36] hover:bg-slate-100 rounded-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          data-testid={`delete-client-${c.id}`}
                          onClick={() => onDelete(c)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-slate-200 rounded-sm p-5 h-fit">
        <div className="font-display font-bold text-sm text-slate-900 mb-4">
          {editing ? "Edit Client" : "Add New Client"}
        </div>
        <div className="space-y-3">
          {[
            { k: "company_name", label: "Company Name *" },
            { k: "initial", label: "Initial (3 letters, e.g. KFS)", maxlength: 6 },
            { k: "contact_person", label: "Contact Person" },
            { k: "phone", label: "Phone" },
            { k: "email", label: "Email" },
            { k: "address", label: "Address" },
            { k: "country", label: "Country" },
          ].map((f) => (
            <div key={f.k}>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">{f.label}</label>
              <input
                data-testid={`client-${f.k}`}
                maxLength={f.maxlength}
                value={form[f.k] || ""}
                onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            data-testid="client-save"
            onClick={onSave}
            className="flex-1 px-3 py-2 bg-[#0B1E36] text-white text-sm font-semibold rounded-sm hover:bg-[#0F294D]"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            {editing ? "Update" : "Add Client"}
          </button>
          {editing && (
            <button
              data-testid="client-cancel"
              onClick={() => { setEditing(null); setForm(EMPTY); }}
              className="px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded-sm hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
