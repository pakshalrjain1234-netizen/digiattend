import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Megaphone, AlertTriangle } from "lucide-react";
import StudentLayout from "../../components/StudentLayout";
import { supabase } from "../../lib/supabase";
import { EmptyState } from "../../components/ui";
import type { Notification } from "../../lib/types";

export default function StudentNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setNotifications(data || []); setLoading(false); });
  }, []);

  const getIcon = (n: Notification) => {
    if (n.audience === "individual") return Bell;
    if (n.title.toLowerCase().includes("attendance") || n.title.toLowerCase().includes("alert")) return AlertTriangle;
    return Megaphone;
  };

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Attendance confirmations, alerts, and college announcements.</p>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl shimmer-bg" />)}</div>
        ) : notifications.length === 0 ? (
          <div className="card p-6"><EmptyState icon={BellOff} title="No notifications" subtitle="You're all caught up!" /></div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n, i) => {
              const Icon = getIcon(n);
              return (
                <motion.div key={n.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="card p-4 card-hover">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{n.title}</p>
                        <span className="text-[10px] text-slate-400 shrink-0">{new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{n.body}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="badge-neutral">{n.audience === "college" ? "College-wide" : n.audience === "individual" ? "Personal" : n.audience}</span>
                        {n.created_by && <span className="text-[10px] text-slate-400">by {n.created_by}</span>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
