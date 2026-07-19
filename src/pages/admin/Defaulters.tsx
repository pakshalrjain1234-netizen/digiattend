import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Download, Search } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase } from "../../lib/supabase";
import { EmptyState } from "../../components/ui";
import { exportToExcel, exportToPDF } from "../../lib/export";
import type { Student, Attendance } from "../../lib/types";

export default function Defaulters() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: studs }, { data: att }, { data: sett }] = await Promise.all([
        supabase.from("students").select("*").eq("status", "active"),
        supabase.from("attendance").select("*"),
        supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      setStudents(studs || []);
      setAttendance(att || []);
      setSettings(sett);
      setLoading(false);
    })();
  }, []);

  const minPct = settings ? Number(settings.min_attendance_pct) : 75;

  const defaulters = students.map((s) => {
    const att = attendance.filter((a) => a.student_id === s.id);
    const present = att.filter((a) => a.attendance_status === "present" || a.attendance_status === "manual").length;
    const pct = att.length > 0 ? Math.round((present / att.length) * 100) : 0;
    return { ...s, present, total: att.length, percentage: pct };
  }).filter((s) => s.percentage < minPct).filter((s) => !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.register_number.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.percentage - b.percentage);

  const handleExportExcel = () => {
    exportToExcel("defaulters.xlsx", defaulters.map((s) => ({ Name: s.full_name, Register: s.register_number, Department: s.department, Year: s.year, Section: s.section, Present: s.present, Total: s.total, Percentage: `${s.percentage}%` })));
  };

  const handleExportPDF = () => {
    exportToPDF("defaulters.pdf", "Defaulter Report", ["Name", "Register", "Dept", "%"], defaulters.map((s) => [s.full_name, s.register_number, s.department, `${s.percentage}%`]));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Defaulters List</h1>
            <p className="text-sm text-slate-500 mt-1">Students below {minPct}% attendance requirement · {defaulters.length} defaulters</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportExcel} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Excel</button>
            <button onClick={handleExportPDF} className="btn-secondary text-sm"><Download className="w-4 h-4" /> PDF</button>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-error-50 ring-1 ring-error-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-error-500 shrink-0" />
          <p className="text-sm text-error-700">These students have attendance below the minimum requirement of {minPct}%. They may be barred from examinations.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-10" placeholder="Search defaulters" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer-bg" />)}</div>
        ) : defaulters.length === 0 ? (
          <div className="card p-6"><EmptyState icon={AlertTriangle} title="No defaulters" subtitle="All students meet the attendance requirement." /></div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Register</th>
                    <th className="px-5 py-3 font-semibold">Dept</th>
                    <th className="px-5 py-3 font-semibold">Year</th>
                    <th className="px-5 py-3 font-semibold">Present/Total</th>
                    <th className="px-5 py-3 font-semibold">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {defaulters.map((s, i) => (
                    <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-700 font-medium">{s.full_name}</td>
                      <td className="px-5 py-3 text-slate-400 font-mono text-xs">{s.register_number}</td>
                      <td className="px-5 py-3 text-slate-600">{s.department}</td>
                      <td className="px-5 py-3 text-slate-600">{s.year}</td>
                      <td className="px-5 py-3 text-slate-600">{s.present}/{s.total}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-error-500 rounded-full" style={{ width: `${s.percentage}%` }} /></div>
                          <span className="badge-error">{s.percentage}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
