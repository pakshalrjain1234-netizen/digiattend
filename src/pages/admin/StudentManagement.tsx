import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Search, Plus, Upload, Download, Edit2, Trash2, KeyRound, Power, AlertCircle, Loader2 } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import { Modal, EmptyState } from "../../components/ui";
import { exportToExcel } from "../../lib/export";
import ImportStudents from "./ImportStudents";
import type { Student } from "../../lib/types";

const DEPARTMENTS = ["AI & DS", "CSE", "ECE", "EEE", "MECH", "CIVIL", "IT"];
const YEARS = ["1", "2", "3", "4"];


export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [form, setForm] = useState({ full_name: "", register_number: "", email: "", department: DEPARTMENTS[0], year: "1", section: "", phone: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = async () => {
    const { data } = await supabase.from("students").select("*").order("register_number", { ascending: true });
    setStudents(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = students.filter((s) => {
    const ms = !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.register_number.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const md = !deptFilter || s.department === deptFilter;
    const my = !yearFilter || s.year === yearFilter;
    return ms && md && my;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await callEdgeFunction("admin-ops", { action: "create_student", ...form });
      setShowAdd(false);
      setForm({ full_name: "", register_number: "", email: "", department: DEPARTMENTS[0], year: "1", section: "", phone: "", password: "" });
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await callEdgeFunction("admin-ops", { action: "update_student", id: selected!.id, ...form });
      setShowEdit(false);
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s: Student) => {
    if (!confirm(`Delete ${s.full_name}? This will remove their auth account and all attendance records.`)) return;
    await callEdgeFunction("admin-ops", { action: "delete_student", id: s.id });
    await load();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await callEdgeFunction("admin-ops", { action: "reset_password", id: selected!.id, password: newPassword });
      setShowReset(false);
      setNewPassword("");
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleToggleStatus = async (s: Student) => {
    const newStatus = s.status === "active" ? "inactive" : "active";
    await callEdgeFunction("admin-ops", { action: "toggle_status", id: s.id, status: newStatus });
    await load();
  };

  const handleExport = () => {
    exportToExcel("students.xlsx", filtered.map((s) => ({
      Register: s.register_number, Name: s.full_name, Email: s.email, Department: s.department, Year: s.year, Room: s.section, Phone: s.phone || "", Status: s.status,
    })));
  };

  const openEdit = (s: Student) => {
    setSelected(s);
    setForm({ full_name: s.full_name, register_number: s.register_number, email: s.email, department: s.department, year: s.year, section: s.section, phone: s.phone || "", password: "" });
    setShowEdit(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Student Management</h1>
            <p className="text-sm text-slate-500 mt-1">{students.length} students · {students.filter(s => s.status === "active").length} active</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="btn-secondary text-sm"><Upload className="w-4 h-4" /> Import</button>
            <button onClick={handleExport} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => { setForm({ full_name: "", register_number: "", email: "", department: DEPARTMENTS[0], year: "1", section: "", phone: "", password: "" }); setShowAdd(true); }} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Student</button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-10" placeholder="Search name, register number, email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-40" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All Depts</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="input w-32" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer-bg" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6"><EmptyState icon={Users} title="No students found" subtitle="Add students or adjust filters." /></div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Register</th>
                    <th className="px-5 py-3 font-semibold">Dept</th>
                    <th className="px-5 py-3 font-semibold">Year</th>
                    <th className="px-5 py-3 font-semibold">Room</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0">{s.full_name[0]}</div>
                          <div><p className="font-medium text-slate-700">{s.full_name}</p><p className="text-xs text-slate-400">{s.email}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600 font-mono text-xs">{s.register_number}</td>
                      <td className="px-5 py-3 text-slate-600">{s.department}</td>
                      <td className="px-5 py-3 text-slate-600">{s.year}</td>
                      <td className="px-5 py-3 text-slate-600">{s.section}</td>
                      <td className="px-5 py-3"><span className={`badge ${s.status === "active" ? "badge-success" : "badge-error"}`}>{s.status}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary-600" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => { setSelected(s); setShowReset(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-warning-600" title="Reset Password"><KeyRound className="w-4 h-4" /></button>
                          <button onClick={() => handleToggleStatus(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-accent-600" title="Toggle Status"><Power className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-error-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Student">
        <StudentForm form={form} setForm={setForm} onSubmit={handleAdd} saving={saving} error={error} includePassword />
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Edit ${selected?.full_name}`}>
        <StudentForm form={form} setForm={setForm} onSubmit={handleEdit} saving={saving} error={error} />
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={showReset} onClose={() => setShowReset(false)} title={`Reset Password — ${selected?.full_name}`} size="sm">
        {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div><label className="label">New Password</label><input type="text" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} placeholder="Minimum 6 characters" /></div>
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}</button>
        </form>
      </Modal>

      <ImportStudents open={showImport} onClose={() => setShowImport(false)} onComplete={load} />
    </AdminLayout>
  );
}

function StudentForm({ form, setForm, onSubmit, saving, error, includePassword }: {
  form: any; setForm: any; onSubmit: (e: React.FormEvent) => void; saving: boolean; error: string; includePassword?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Full Name</label><input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><label className="label">Register Number</label><input className="input" required value={form.register_number} onChange={(e) => setForm({ ...form, register_number: e.target.value })} /></div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                e.target.setCustomValidity("Please enter a valid email address (e.g. name@gmail.com)");
              } else if (val && val.toLowerCase().includes("@gamil.")) {
                e.target.setCustomValidity("Did you mean @gmail.com? Check for typos.");
              } else {
                e.target.setCustomValidity("");
              }
            }}
            onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
            placeholder="name@gmail.com"
          />
        </div>
        <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label">Department</label><select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
        <div><label className="label">Year</label><select className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
        <div><label className="label">Room Number</label><input className="input" required value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="e.g. 301, Lab-2, A-Block" /></div>
        {includePassword && <div><label className="label">Password</label><input type="text" className="input" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 chars" /></div>}
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</button>
    </form>
  );
}