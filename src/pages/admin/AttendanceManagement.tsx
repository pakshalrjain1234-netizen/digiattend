import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Search, Edit2, Trash2, Plus, Download, Loader2, AlertCircle } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import { Modal, EmptyState } from "../../components/ui";
import { exportToExcel } from "../../lib/export";
import type { Attendance, Student } from "../../lib/types";

export default function AttendanceManagement() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selected, setSelected] = useState<Attendance | null>(null);
  const [manualForm, setManualForm] = useState({ student_id: "", date: new Date().toISOString().slice(0, 10), status: "manual", notes: "" });
  const [editForm, setEditForm] = useState({ attendance_status: "present", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [{ data: att }, { data: studs }] = await Promise.all([
      supabase.from("attendance").select("*").order("date", { ascending: false }).order("time", { ascending: false }).limit(500),
      supabase.from("students").select("*").order("full_name"),
    ]);
    setRecords(att || []);
    setStudents(studs || []);
    setLoading(false);
  };

  const filtered = records.filter((r) => {
    const ms = !search || r.student_name.toLowerCase().includes(search.toLowerCase()) || r.register_number.toLowerCase().includes(search.toLowerCase());
    const md = !dateFilter || r.date === dateFilter;
    const mst = !statusFilter || r.attendance_status === statusFilter;
    return ms && md && mst;
  });

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await callEdgeFunction("admin-ops", { action: "manual_attendance", ...manualForm });
      setShowManual(false);
      setManualForm({ student_id: "", date: new Date().toISOString().slice(0, 10), status: "manual", notes: "" });
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (r: Attendance) => {
    setSelected(r);
    setEditForm({ attendance_status: r.attendance_status, notes: r.notes || "" });
    setShowEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await callEdgeFunction("admin-ops", { action: "edit_attendance", id: selected!.id, ...editForm });
      setShowEdit(false);
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (r: Attendance) => {
    if (!confirm(`Delete attendance for ${r.student_name} on ${r.date}?`)) return;
    await callEdgeFunction("admin-ops", { action: "delete_attendance", id: r.id });
    await load();
  };

  const handleExport = () => {
    exportToExcel("attendance.xlsx", filtered.map((r) => ({
      Date: r.date, Time: r.time, Register: r.register_number, Name: r.student_name, Department: r.department, Year: r.year, Section: r.section, Status: r.attendance_status, IP: r.ip_address || "", Notes: r.notes || "",
    })));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Attendance Management</h1>
            <p className="text-sm text-slate-500 mt-1">{filtered.length} records</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => setShowManual(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Manual Entry</button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-10" placeholder="Search name or register number" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <input type="date" className="input w-44" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          <select className="input w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer-bg" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6"><EmptyState icon={CalendarCheck} title="No attendance records" subtitle="Adjust filters or add a manual entry." /></div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                    <th className="px-5 py-3 font-semibold">Student</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Time</th>
                    <th className="px-5 py-3 font-semibold">Dept</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Location</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3"><p className="font-medium text-slate-700">{r.student_name}</p><p className="text-xs text-slate-400 font-mono">{r.register_number}</p></td>
                      <td className="px-5 py-3 text-slate-600">{r.date}</td>
                      <td className="px-5 py-3 text-slate-600">{r.time}</td>
                      <td className="px-5 py-3 text-slate-600">{r.department}</td>
                      <td className="px-5 py-3"><span className={`badge ${r.attendance_status === "present" ? "badge-success" : r.attendance_status === "absent" ? "badge-error" : "badge-warning"}`}>{r.attendance_status}</span></td>
                      <td className="px-5 py-3 text-xs text-slate-500">{r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}` : "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary-600"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-error-600"><Trash2 className="w-4 h-4" /></button>
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

      <Modal open={showManual} onClose={() => setShowManual(false)} title="Manual Attendance Entry">
        {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
        <form onSubmit={handleManual} className="space-y-4">
          <div><label className="label">Student</label><select className="input" required value={manualForm.student_id} onChange={(e) => setManualForm({ ...manualForm, student_id: e.target.value })}><option value="">Select student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.register_number}</option>)}</select></div>
          <div><label className="label">Date</label><input type="date" className="input" required value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })} /></div>
          <div><label className="label">Status</label><select className="input" value={manualForm.status} onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}><option value="manual">Manual</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option></select></div>
          <div><label className="label">Notes</label><input className="input" value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} placeholder="Reason for manual entry" /></div>
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Manual Attendance"}</button>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Edit — ${selected?.student_name}`} size="sm">
        {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
        <form onSubmit={handleEdit} className="space-y-4">
          <div><label className="label">Status</label><select className="input" value={editForm.attendance_status} onChange={(e) => setEditForm({ ...editForm, attendance_status: e.target.value })}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="manual">Manual</option></select></div>
          <div><label className="label">Notes</label><input className="input" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}</button>
        </form>
      </Modal>
    </AdminLayout>
  );
}
