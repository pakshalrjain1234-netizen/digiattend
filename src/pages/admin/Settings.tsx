import { useEffect, useState } from "react";
import { Save, Loader2, AlertCircle, CheckCircle2, Clock, GraduationCap, Building2 } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import type { Settings } from "../../lib/types";

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      setSettings(data as Settings);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(""); setError("");
    try {
      await callEdgeFunction("admin-ops", { action: "update_settings", ...settings });
      setMsg("Settings saved successfully.");
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <AdminLayout><div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl shimmer-bg" />)}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Configure attendance rules, geofence, and college information.</p>
        </div>

        {msg && <div className="flex items-center gap-2 bg-accent-50 text-accent-700 text-sm rounded-xl px-4 py-3 ring-1 ring-accent-200"><CheckCircle2 className="w-4 h-4" /> {msg}</div>}
        {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Attendance window */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary-500" />
              <h2 className="font-display font-semibold text-slate-900">Attendance Window</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="label">Start Time</label><input type="time" className="input" value={settings?.attendance_start || ""} onChange={(e) => setSettings({ ...settings!, attendance_start: e.target.value })} /></div>
              <div><label className="label">End Time</label><input type="time" className="input" value={settings?.attendance_end || ""} onChange={(e) => setSettings({ ...settings!, attendance_end: e.target.value })} /></div>
              <div><label className="label">Grace Period (min)</label><input type="number" className="input" value={settings?.grace_minutes || 0} onChange={(e) => setSettings({ ...settings!, grace_minutes: parseInt(e.target.value) })} /></div>
            </div>
          </div>

          {/* Requirements */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-accent-500" />
              <h2 className="font-display font-semibold text-slate-900">Attendance Requirements</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="label">Minimum Attendance %</label><input type="number" className="input" value={settings?.min_attendance_pct || 0} onChange={(e) => setSettings({ ...settings!, min_attendance_pct: parseFloat(e.target.value) })} /></div>
              <div><label className="label">Default Geofence Radius (m)</label><input type="number" className="input" value={settings?.geofence_radius || 500} onChange={(e) => setSettings({ ...settings!, geofence_radius: parseInt(e.target.value) })} /></div>
              <div><label className="label">GPS Accuracy Limit (m)</label><input type="number" className="input" value={settings?.gps_accuracy_limit || 150} onChange={(e) => setSettings({ ...settings!, gps_accuracy_limit: parseInt(e.target.value) })} /></div>
            </div>
            <p className="text-xs text-slate-400 mt-3">Geofence radius defines how far from campus center students can mark attendance. GPS accuracy limit rejects attendance if location accuracy exceeds this value (default 150m, suitable for indoor campus use).</p>
          </div>

          {/* College info */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-primary-500" />
              <h2 className="font-display font-semibold text-slate-900">College Information</h2>
            </div>
            <div className="space-y-4">
              <div><label className="label">College Name</label><input className="input" value={settings?.college_name || ""} onChange={(e) => setSettings({ ...settings!, college_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">College Latitude</label><input type="number" step="any" className="input" value={settings?.college_latitude || 0} onChange={(e) => setSettings({ ...settings!, college_latitude: parseFloat(e.target.value) })} /></div>
                <div><label className="label">College Longitude</label><input type="number" step="any" className="input" value={settings?.college_longitude || 0} onChange={(e) => setSettings({ ...settings!, college_longitude: parseFloat(e.target.value) })} /></div>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Settings</>}</button>
        </form>
      </div>
    </AdminLayout>
  );
}
