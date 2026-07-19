import { useEffect, useMemo, useState } from "react";
import { Calendar, Download, Search, ChevronLeft, ChevronRight, CalendarX } from "lucide-react";
import StudentLayout from "../../components/StudentLayout";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { EmptyState } from "../../components/ui";
import { exportToExcel, exportToPDF } from "../../lib/export";
import type { Attendance } from "../../lib/types";

export default function AttendanceHistory() {
  const { student } = useAuth();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());

  useEffect(() => {
    if (!student) return;
    supabase.from("attendance").select("*").eq("student_id", student.id).order("date", { ascending: false })
      .then(({ data }) => { setRecords(data || []); setLoading(false); });
  }, [student]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchSearch = !search || r.date.includes(search) || r.attendance_status.includes(search.toLowerCase());
      const matchMonth = !monthFilter || r.date.startsWith(monthFilter);
      return matchSearch && matchMonth;
    });
  }, [records, search, monthFilter]);

  const present = records.filter((r) => r.attendance_status === "present" || r.attendance_status === "manual").length;
  const absent = records.filter((r) => r.attendance_status === "absent").length;
  const pct = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    records.forEach((r) => m.set(r.date, r.attendance_status));
    return m;
  }, [records]);

  const calendar = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [calMonth]);

  const handleExportExcel = () => {
    exportToExcel("attendance_history.xlsx", filtered.map((r) => ({
      Date: r.date, Time: r.time, Status: r.attendance_status, Department: r.department, Notes: r.notes || "",
    })));
  };

  const handleExportPDF = () => {
    exportToPDF("attendance_history.pdf", "Attendance History", ["Date", "Time", "Status"],
      filtered.map((r) => [r.date, r.time, r.attendance_status]));
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Attendance History</h1>
            <p className="text-sm text-slate-500 mt-1">View, search, and download your attendance records.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportExcel} className="btn-secondary py-2 text-sm"><Download className="w-4 h-4" /> Excel</button>
            <button onClick={handleExportPDF} className="btn-secondary py-2 text-sm"><Download className="w-4 h-4" /> PDF</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card"><p className="text-xs font-semibold text-slate-500 uppercase">Present</p><p className="text-2xl font-bold text-accent-600 mt-1">{present}</p></div>
          <div className="stat-card"><p className="text-xs font-semibold text-slate-500 uppercase">Absent</p><p className="text-2xl font-bold text-error-500 mt-1">{absent}</p></div>
          <div className="stat-card"><p className="text-xs font-semibold text-slate-500 uppercase">Percentage</p><p className="text-2xl font-bold text-primary-600 mt-1">{pct}%</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Calendar</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-semibold text-slate-700 w-28 text-center">{calMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-[10px] font-semibold text-slate-400 py-1">{d}</div>)}
              {calendar.map((date, i) => {
                if (!date) return <div key={i} />;
                const dateStr = date.toISOString().slice(0, 10);
                const status = statusMap.get(dateStr);
                const isToday = dateStr === new Date().toISOString().slice(0, 10);
                return (
                  <div key={i} className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium relative transition-all ${
                    status === "present" || status === "manual" ? "bg-accent-100 text-accent-700" :
                    status === "absent" ? "bg-error-100 text-error-700" :
                    status === "late" ? "bg-warning-100 text-warning-700" :
                    isToday ? "bg-primary-50 text-primary-700 ring-1 ring-primary-300" : "text-slate-500 hover:bg-slate-50"
                  }`}>
                    {date.getDate()}
                    {status && <div className={`absolute bottom-1 w-1 h-1 rounded-full ${status === "absent" ? "bg-error-400" : "bg-accent-400"}`} />}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-accent-100" /> Present</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-error-100" /> Absent</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-warning-100" /> Late</span>
            </div>
          </div>

          {/* History list */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input className="input pl-9 py-2" placeholder="Search by date or status" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <input type="month" className="input py-2 w-36" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
            </div>
            {loading ? (
              <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer-bg" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={CalendarX} title="No records found" subtitle="Try adjusting your filters." />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                {filtered.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-2.5 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p className="text-xs text-slate-400">{r.time} · {r.attendance_status === "present" ? "On time" : r.attendance_status}</p>
                      </div>
                    </div>
                    <span className={`badge ${r.attendance_status === "present" ? "badge-success" : r.attendance_status === "absent" ? "badge-error" : "badge-warning"}`}>{r.attendance_status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
