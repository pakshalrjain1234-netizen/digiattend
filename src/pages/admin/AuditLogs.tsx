import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Search, Shield, GraduationCap, CalendarCheck, Users, QrCode, Settings, Upload, Download } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase } from "../../lib/supabase";
import { EmptyState } from "../../components/ui";
import type { AuditLog } from "../../lib/types";

const actionIcons: Record<string, any> = {
  login: Shield, student_login: GraduationCap, admin_login: Shield,
  mark_attendance: CalendarCheck, attendance_update: CalendarCheck,
  create_student: Users, delete_student: Users, update_student: Users,
  import_students: Upload, export: Download, qr_generation: QrCode,
  settings_change: Settings,
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, []);

  const actions = [...new Set(logs.map((l) => l.action))];

  const filtered = logs.filter((l) => {
    const ms = !search || l.actor.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase());
    const ma = !actionFilter || l.action === actionFilter;
    return ms && ma;
  });

  const getIcon = (action: string) => {
    for (const key of Object.keys(actionIcons)) {
      if (action.includes(key)) return actionIcons[key];
    }
    return History;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">{logs.length} logged events · System activity trail.</p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-10" placeholder="Search by actor or action" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-52" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer-bg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="card p-6"><EmptyState icon={History} title="No audit logs" subtitle="System activity will appear here." /></div>
        ) : (
          <div className="card p-6">
            <div className="space-y-1 max-h-[600px] overflow-y-auto scrollbar-thin">
              {filtered.map((log, i) => {
                const Icon = getIcon(log.action);
                return (
                  <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.01 }}
                    className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700"><span className="font-medium">{log.actor}</span> <span className="text-slate-400">performed</span> <span className="font-medium text-primary-600">{log.action.replace(/_/g, " ")}</span></p>
                      {log.detail && <p className="text-xs text-slate-400 mt-0.5">{JSON.stringify(log.detail)}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      <p className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                      {log.ip_address && log.ip_address !== "unknown" && <p className="text-[10px] text-slate-400 font-mono">{log.ip_address}</p>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
