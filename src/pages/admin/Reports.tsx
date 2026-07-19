import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download, FileText, Calendar, Building2, AlertTriangle, Users } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase } from "../../lib/supabase";
import { exportToExcel, exportToPDF } from "../../lib/export";
import type { Student, Attendance } from "../../lib/types";

type ReportType = "daily" | "weekly" | "monthly" | "student" | "department" | "defaulter";

export default function Reports() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [deptFilter, setDeptFilter] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: studs }, { data: att }] = await Promise.all([
        supabase.from("students").select("*"),
        supabase.from("attendance").select("*").order("date", { ascending: false }),
      ]);
      setStudents(studs || []);
      setAttendance(att || []);
      setLoading(false);
    })();
  }, []);

  const depts = [...new Set(students.map((s) => s.department))];

  const filteredAttendance = attendance.filter((a) => {
    const md = !dateFrom || a.date >= dateFrom;
    const mt = !dateTo || a.date <= dateTo;
    const mDept = !deptFilter || a.department === deptFilter;
    return md && mt && mDept;
  });

  const dailyData = (() => {
    const map = new Map<string, { present: number; absent: number; late: number }>();
    filteredAttendance.forEach((a) => {
      if (!map.has(a.date)) map.set(a.date, { present: 0, absent: 0, late: 0 });
      const d = map.get(a.date)!;
      if (a.attendance_status === "present" || a.attendance_status === "manual") d.present++;
      else if (a.attendance_status === "absent") d.absent++;
      else if (a.attendance_status === "late") d.late++;
    });
    return Array.from(map.entries()).sort().reverse().slice(0, 14).map(([date, v]) => ({ date, ...v })).reverse();
  })();

  const deptData = (() => {
    const map = new Map<string, { present: number; absent: number; total: number }>();
    students.forEach((s) => {
      if (!map.has(s.department)) map.set(s.department, { present: 0, absent: 0, total: 0 });
      map.get(s.department)!.total++;
    });
    filteredAttendance.forEach((a) => {
      if (map.has(a.department)) {
        if (a.attendance_status === "present" || a.attendance_status === "manual") map.get(a.department)!.present++;
        else if (a.attendance_status === "absent") map.get(a.department)!.absent++;
      }
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, present: v.present, absent: v.absent }));
  })();

  const studentData = students.map((s) => {
    const att = filteredAttendance.filter((a) => a.student_id === s.id);
    const present = att.filter((a) => a.attendance_status === "present" || a.attendance_status === "manual").length;
    const pct = att.length > 0 ? Math.round((present / att.length) * 100) : 0;
    return { name: s.full_name, register: s.register_number, department: s.department, year: s.year, section: s.section, present, total: att.length, percentage: pct };
  });

  const handleExportExcel = () => {
    let rows: any[] = [];
    if (reportType === "daily" || reportType === "weekly" || reportType === "monthly") {
      rows = filteredAttendance.map((r) => ({ Date: r.date, Time: r.time, Register: r.register_number, Name: r.student_name, Department: r.department, Status: r.attendance_status }));
    } else if (reportType === "student") {
      rows = studentData.map((s) => ({ Name: s.name, Register: s.register, Department: s.department, Present: s.present, Total: s.total, Percentage: `${s.percentage}%` }));
    } else if (reportType === "department") {
      rows = deptData.map((d) => ({ Department: d.name, Present: d.present, Absent: d.absent }));
    } else if (reportType === "defaulter") {
      rows = studentData.filter((s) => s.percentage < 75).map((s) => ({ Name: s.name, Register: s.register, Department: s.department, Percentage: `${s.percentage}%` }));
    }
    exportToExcel(`report-${reportType}.xlsx`, rows);
  };

  const handleExportPDF = () => {
    if (reportType === "daily" || reportType === "weekly" || reportType === "monthly") {
      exportToPDF(`report-${reportType}.pdf`, `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, ["Date", "Register", "Name", "Dept", "Status"],
        filteredAttendance.map((r) => [r.date, r.register_number, r.student_name, r.department, r.attendance_status]));
    } else if (reportType === "student") {
      exportToPDF("report-student.pdf", "Student-wise Report", ["Name", "Register", "Dept", "Present", "Total", "%"],
        studentData.map((s) => [s.name, s.register, s.department, String(s.present), String(s.total), `${s.percentage}%`]));
    } else if (reportType === "department") {
      exportToPDF("report-department.pdf", "Department-wise Report", ["Department", "Present", "Absent"],
        deptData.map((d) => [d.name, String(d.present), String(d.absent)]));
    } else if (reportType === "defaulter") {
      const defaulters = studentData.filter((s) => s.percentage < 75);
      exportToPDF("report-defaulter.pdf", "Defaulter Report", ["Name", "Register", "Dept", "%"],
        defaulters.map((s) => [s.name, s.register, s.department, `${s.percentage}%`]));
    }
  };

  const reportTypes = [
    { key: "daily" as ReportType, label: "Daily", icon: Calendar },
    { key: "weekly" as ReportType, label: "Weekly", icon: Calendar },
    { key: "monthly" as ReportType, label: "Monthly", icon: Calendar },
    { key: "student" as ReportType, label: "Student-wise", icon: Users },
    { key: "department" as ReportType, label: "Department-wise", icon: Building2 },
    { key: "defaulter" as ReportType, label: "Defaulter", icon: AlertTriangle },
  ];

  if (loading) return <AdminLayout><div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl shimmer-bg" />)}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500 mt-1">Generate and export attendance reports.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportExcel} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Excel</button>
            <button onClick={handleExportPDF} className="btn-secondary text-sm"><FileText className="w-4 h-4" /> PDF</button>
          </div>
        </div>

        {/* Report type selector */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {reportTypes.map((rt) => (
            <button key={rt.key} onClick={() => setReportType(rt.key)}
              className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-xs font-semibold transition-all ${reportType === rt.key ? "bg-primary-600 text-white border-primary-500" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}>
              <rt.icon className="w-5 h-5" /> {rt.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div><label className="label">From Date</label><input type="date" className="input w-44" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><label className="label">To Date</label><input type="date" className="input w-44" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div><label className="label">Department</label><select className="input w-44" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}><option value="">All</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
        </div>

        {/* Charts */}
        {(reportType === "daily" || reportType === "weekly" || reportType === "monthly") && (
          <div className="card p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-4">Attendance Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a" }} />
                <Legend wrapperStyle={{ color: "#64748b", fontSize: 12 }} />
                <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {reportType === "department" && (
          <div className="card p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-4">Department-wise Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a" }} />
                <Legend wrapperStyle={{ color: "#64748b", fontSize: 12 }} />
                <Bar dataKey="present" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="absent" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Data table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                  {reportType === "defaulter" ? (
                    <><th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Register</th><th className="px-5 py-3 font-semibold">Dept</th><th className="px-5 py-3 font-semibold">%</th></>
                  ) : reportType === "student" ? (
                    <><th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Register</th><th className="px-5 py-3 font-semibold">Dept</th><th className="px-5 py-3 font-semibold">Present</th><th className="px-5 py-3 font-semibold">Total</th><th className="px-5 py-3 font-semibold">%</th></>
                  ) : reportType === "department" ? (
                    <><th className="px-5 py-3 font-semibold">Department</th><th className="px-5 py-3 font-semibold">Present</th><th className="px-5 py-3 font-semibold">Absent</th></>
                  ) : (
                    <><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Register</th><th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Dept</th><th className="px-5 py-3 font-semibold">Status</th></>
                  )}
                </tr>
              </thead>
              <tbody>
                {reportType === "defaulter" && studentData.filter((s) => s.percentage < 75).map((s, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{s.name}</td><td className="px-5 py-3 text-slate-400 font-mono text-xs">{s.register}</td><td className="px-5 py-3 text-slate-600">{s.department}</td><td className="px-5 py-3"><span className="badge-error">{s.percentage}%</span></td>
                  </tr>
                ))}
                {reportType === "student" && studentData.map((s, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{s.name}</td><td className="px-5 py-3 text-slate-400 font-mono text-xs">{s.register}</td><td className="px-5 py-3 text-slate-600">{s.department}</td><td className="px-5 py-3 text-accent-600">{s.present}</td><td className="px-5 py-3 text-slate-600">{s.total}</td><td className="px-5 py-3"><span className={`badge ${s.percentage >= 75 ? "badge-success" : "badge-error"}`}>{s.percentage}%</span></td>
                  </tr>
                ))}
                {reportType === "department" && deptData.map((d, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{d.name}</td><td className="px-5 py-3 text-accent-600">{d.present}</td><td className="px-5 py-3 text-error-600">{d.absent}</td>
                  </tr>
                ))}
                {(reportType === "daily" || reportType === "weekly" || reportType === "monthly") && filteredAttendance.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{r.date}</td><td className="px-5 py-3 text-slate-400 font-mono text-xs">{r.register_number}</td><td className="px-5 py-3 text-slate-700">{r.student_name}</td><td className="px-5 py-3 text-slate-600">{r.department}</td><td className="px-5 py-3"><span className={`badge ${r.attendance_status === "present" ? "badge-success" : r.attendance_status === "absent" ? "badge-error" : "badge-warning"}`}>{r.attendance_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
