import { useEffect, useState } from "react";
import { Megaphone, Send, Loader2, AlertCircle, Bell } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import { EmptyState } from "../../components/ui";
import type { Notification, Student } from "../../lib/types";

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", body: "", audience: "college", department: "", year: "", section: "", student_id: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: notifs }, { data: studs }] = await Promise.all([
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("students").select("*").order("full_name"),
      ]);
      setNotifications(notifs || []);
      setStudents(studs || []);
      setLoading(false);
    })();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setError(""); setSuccess("");
    try {
      const payload: any = { action: "send_notification", title: form.title, body: form.body, audience: form.audience };
      if (form.audience === "department") payload.department = form.department;
      if (form.audience === "year") { payload.year = form.year; payload.department = form.department; }
      if (form.audience === "section") { payload.section = form.section; payload.year = form.year; payload.department = form.department; }
      if (form.audience === "individual") payload.student_id = form.student_id;
      await callEdgeFunction("admin-ops", payload);
      setSuccess("Notification sent successfully.");
      setForm({ title: "", body: "", audience: "college", department: "", year: "", section: "", student_id: "" });
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
      setNotifications(data || []);
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  };

  const depts = [...new Set(students.map((s) => s.department))];
  const years = [...new Set(students.map((s) => s.year))];
  const sections = [...new Set(students.map((s) => s.section))];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Send announcements to students by audience scope.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compose */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-5 h-5 text-primary-500" />
              <h2 className="font-display font-semibold text-slate-900">Compose Announcement</h2>
            </div>
            {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
            {success && <div className="flex items-center gap-2 bg-accent-50 text-accent-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-accent-200">{success}</div>}
            <form onSubmit={handleSend} className="space-y-4">
              <div><label className="label">Title</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" /></div>
              <div><label className="label">Message</label><textarea className="input min-h-24" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write your message..." /></div>
              <div><label className="label">Audience</label><select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="college">Entire College</option>
                <option value="department">Department</option>
                <option value="year">Year</option>
                <option value="section">Section</option>
                <option value="individual">Individual Student</option>
              </select></div>
              {form.audience === "department" && <div><label className="label">Department</label><select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}><option value="">Select</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>}
              {form.audience === "year" && <><div><label className="label">Department</label><select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}><option value="">All</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div><div><label className="label">Year</label><select className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}><option value="">Select</option>{years.map((y) => <option key={y} value={y}>Year {y}</option>)}</select></div></>}
              {form.audience === "section" && <><div><label className="label">Department</label><select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}><option value="">All</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div><div><label className="label">Year</label><select className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}><option value="">All</option>{years.map((y) => <option key={y} value={y}>Year {y}</option>)}</select></div><div><label className="label">Section</label><select className="input" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}><option value="">Select</option>{sections.map((s) => <option key={s} value={s}>{s}</option>)}</select></div></>}
              {form.audience === "individual" && <div><label className="label">Student</label><select className="input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}><option value="">Select student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.register_number}</option>)}</select></div>}
              <button type="submit" disabled={sending} className="btn-primary w-full">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Notification</>}</button>
            </form>
          </div>

          {/* History */}
          <div className="card p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-4">Recent Notifications</h2>
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer-bg" />)}</div>
            ) : notifications.length === 0 ? (
              <EmptyState icon={Bell} title="No notifications sent yet" />
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto scrollbar-thin">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-slate-700">{n.title}</p>
                      <span className="badge-primary text-[10px]">{n.audience}</span>
                    </div>
                    <p className="text-xs text-slate-500">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("en-IN")} {n.created_by && `· by ${n.created_by}`}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
