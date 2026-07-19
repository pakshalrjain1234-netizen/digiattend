import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, UserCheck, UserX, TrendingUp, Activity, Clock, GraduationCap, AlertTriangle, CheckCircle2 } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase } from "../../lib/supabase";
import type { Student, Attendance, AuditLog } from "../../lib/types";

export default function AdminDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: studs }, { data: todayAtt }, { data: allAtt }, { data: audit }] = await Promise.all([
        supabase.from("students").select("*"),
        supabase.from("attendance").select("*").eq("date", today),
        supabase.from("attendance").select("*").order("date", { ascending: false }).limit(500),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      setStudents(studs || []);
      setTodayAttendance(todayAtt || []);
      setAllAttendance(allAtt || []);
      setLogs(audit || []);
      setLoading(false);
    })();
  }, []);

  const activeStudents = students.filter((s) => s.status === "active");
  const presentToday = todayAttendance.filter((a) => a.attendance_status === "present" || a.attendance_status === "manual").length;
  const lateToday = todayAttendance.filter((a) => a.attendance_status === "late").length;
  const absentToday = activeStudents.length - presentToday - lateToday;
  const pct = activeStudents.length > 0 ? Math.round(((presentToday + lateToday) / activeStudents.length) * 100) : 0;

  const trendData = (() => {
    const days: { date: string; present: number; absent: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const dayAtt = allAttendance.filter((a) => a.date === ds);
      days.push({
        date: d.toLocaleDateString("en-IN", { weekday: "short" }),
        present: dayAtt.filter((a) => a.attendance_status === "present" || a.attendance_status === "manual").length,
        absent: Math.max(activeStudents.length - dayAtt.length, 0),
      });
    }
    return days;
  })();

  const deptData = (() => {
    const depts = new Map<string, { present: number; total: number }>();
    activeStudents.forEach((s) => {
      if (!depts.has(s.department)) depts.set(s.department, { present: 0, total: 0 });
      depts.get(s.department)!.total++;
    });
    todayAttendance.forEach((a) => {
      if (a.attendance_status === "present" || a.attendance_status === "manual") {
        if (depts.has(a.department)) depts.get(a.department)!.present++;
      }
    });
    return Array.from(depts.entries()).map(([name, v]) => ({ name, present: v.present, absent: Math.max(v.total - v.present, 0) }));
  })();

  const pieData = [
    { name: "Present", value: presentToday, color: "#10b981" },
    { name: "Late", value: lateToday, color: "#f59e0b" },
    { name: "Absent", value: Math.max(absentToday, 0), color: "#ef4444" },
  ];

  const stats = [
    { label: "Total Students", value: students.length, icon: Users, color: "primary" },
    { label: "Present Today", value: presentToday + lateToday, icon: UserCheck, color: "accent" },
    { label: "Absent Today", value: Math.max(absentToday, 0), icon: UserX, color: "error" },
    { label: "Attendance %", value: `${pct}%`, icon: TrendingUp, color: "warning" },
  ];

  if (loading) return <AdminLayout><div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl shimmer-bg" />)}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time attendance overview for {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5 card-hover">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                <s.icon className={`w-5 h-5 text-${s.color}-500`} />
              </div>
              <p className="text-3xl font-bold text-slate-900">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Live progress */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent-500" />
              <h2 className="font-display font-semibold text-slate-900">Today's Attendance Progress</h2>
            </div>
            <span className="text-sm text-slate-500">{presentToday + lateToday} / {activeStudents.length}</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full bg-gradient-to-r from-accent-500 to-primary-500 rounded-full" />
          </div>
          <p className="text-sm text-slate-500 mt-2">{pct}% of active students have marked attendance</p>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-4">Weekly Trend</h2>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendData}>
                <defs><linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a" }} />
                <Area type="monotone" dataKey="present" stroke="#10b981" fill="url(#gradP)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-4">Today's Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a" }} />
                <Legend wrapperStyle={{ color: "#64748b", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department chart */}
        <div className="card p-6">
          <h2 className="font-display font-semibold text-slate-900 mb-4">Department-wise Attendance</h2>
          <ResponsiveContainer width="100%" height={280}>
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

        {/* Activity feed */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary-500" />
            <h2 className="font-display font-semibold text-slate-900">Recent Activity</h2>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No recent activity.</p>
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    {log.action.includes("login") ? <GraduationCap className="w-4 h-4 text-slate-500" /> :
                     log.action.includes("attendance") || log.action.includes("mark") ? <CheckCircle2 className="w-4 h-4 text-accent-500" /> :
                     <AlertTriangle className="w-4 h-4 text-warning-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700"><span className="font-medium">{log.actor}</span> — {log.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
