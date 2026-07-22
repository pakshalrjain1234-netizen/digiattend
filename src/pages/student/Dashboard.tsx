import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, CalendarX, TrendingUp, Clock, Bell, GraduationCap, AlertCircle } from "lucide-react";
import StudentLayout from "../../components/StudentLayout";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { EmptyState } from "../../components/ui";
import type { Attendance, Notification, Settings } from "../../lib/types";

export default function StudentDashboard() {
  const { student } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!student) return;
    (async () => {
      const [{ data: att }, { data: notifs }, { data: sett }] = await Promise.all([
        supabase.from("attendance").select("*").eq("student_id", student.id).order("date", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      setAttendance(att || []);
      setNotifications(notifs || []);
      setSettings(sett as Settings);
      setLoading(false);
    })();
  }, [student]);

  const today = now.toISOString().slice(0, 10);
  const todayAtt = attendance.find((a) => a.date === today);
  const presentDays = attendance.filter((a) => a.attendance_status === "present" || a.attendance_status === "manual" || a.attendance_status === "late").length;
  const totalDays = attendance.length;
  const absentDays = attendance.filter((a) => a.attendance_status === "absent").length;
  const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
  const minPct = settings ? Number(settings.min_attendance_pct) : 75;

  const recentHistory = attendance.slice(0, 7);

  return (
    <StudentLayout>
      <div className="space-y-6">
        {/* Welcome header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20 overflow-hidden">
                {student?.profile_picture ? <img src={student.profile_picture} alt="" className="w-full h-full object-cover" /> : <GraduationCap className="w-8 h-8" />}
              </div>
              <div>
                <p className="text-primary-200 text-sm">Welcome back,</p>
                <h1 className="font-display text-2xl font-bold">{student?.full_name}</h1>
                <p className="text-primary-200 text-sm mt-0.5">{student?.register_number} · {student?.department} · Year {student?.year} · Sec {student?.section}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-primary-200 text-xs">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="font-mono text-2xl font-bold tabular-nums">{now.toLocaleTimeString("en-IN")}</p>
            </div>
          </div>
        </motion.div>

        {/* Today's status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Today's Status</p>
              {todayAtt ? <CalendarCheck className="w-5 h-5 text-accent-500" /> : <Clock className="w-5 h-5 text-slate-400" />}
            </div>
            {todayAtt ? (
              <div>
                <p className={`text-2xl font-bold ${todayAtt.attendance_status === "present" ? "text-accent-600" : "text-warning-600"}`}>
                  {todayAtt.attendance_status === "present" ? "Present" : todayAtt.attendance_status === "late" ? "Late" : "Marked"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Marked at {todayAtt.time}</p>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-slate-400">Not Marked</p>
                <p className="text-xs text-slate-400 mt-1">Scan QR to mark attendance</p>
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Attendance %</p>
              <TrendingUp className="w-5 h-5 text-primary-500" />
            </div>
            <p className={`text-2xl font-bold ${percentage >= minPct ? "text-accent-600" : "text-error-600"}`}>{percentage}%</p>
            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${percentage >= minPct ? "bg-accent-500" : "bg-error-500"}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Required: {minPct}%</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Present / Absent</p>
              <CalendarCheck className="w-5 h-5 text-accent-500" />
            </div>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-2xl font-bold text-accent-600">{presentDays}</p>
                <p className="text-xs text-slate-400">Present</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-2xl font-bold text-error-500">{absentDays}</p>
                <p className="text-xs text-slate-400">Absent</p>
              </div>
            </div>
          </motion.div>
        </div>

        {percentage < minPct && totalDays > 0 && (
          <div className="flex items-start gap-3 bg-error-50 ring-1 ring-error-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-error-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-error-700">Low Attendance Alert</p>
              <p className="text-xs text-error-600 mt-0.5">Your attendance is below the required {minPct}%. Please attend regularly to avoid being flagged as a defaulter.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent history */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Recent Attendance</h2>
              <a href="/student/history" className="text-xs font-semibold text-primary-600 hover:underline">View all →</a>
            </div>
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl shimmer-bg" />)}</div>
            ) : recentHistory.length === 0 ? (
              <EmptyState icon={CalendarX} title="No attendance yet" subtitle="Your attendance will appear here." />
            ) : (
              <div className="space-y-2">
                {recentHistory.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${a.attendance_status === "present" ? "bg-accent-500" : a.attendance_status === "absent" ? "bg-error-500" : "bg-warning-500"}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{new Date(a.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p className="text-xs text-slate-400">{a.time}</p>
                      </div>
                    </div>
                    <span className={`badge ${a.attendance_status === "present" ? "badge-success" : a.attendance_status === "absent" ? "badge-error" : "badge-warning"}`}>
                      {a.attendance_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Announcements</h2>
              <Bell className="w-4 h-4 text-slate-400" />
            </div>
            {notifications.length === 0 ? (
              <EmptyState icon={Bell} title="No announcements" />
            ) : (
              <div className="space-y-2.5">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-xl border border-slate-100 px-3.5 py-3 hover:bg-slate-50 transition-colors">
                    <p className="text-sm font-semibold text-slate-700">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("en-IN")}</p>
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
