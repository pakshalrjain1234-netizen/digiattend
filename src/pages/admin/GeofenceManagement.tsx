import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Trash2, Power, Loader2, AlertCircle, Navigation, Building2 } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import { Modal, EmptyState } from "../../components/ui";
import type { GeofenceLocation } from "../../lib/types";

export default function GeofenceManagement() {
  const [locations, setLocations] = useState<GeofenceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", radius_meters: "200", is_primary: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("geofence_locations").select("*").order("created_at", { ascending: false });
    setLocations(data || []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await callEdgeFunction("admin-ops", {
        action: "upsert_geofence",
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radius_meters: parseInt(form.radius_meters),
        is_primary: form.is_primary,
        enabled: true,
      });
      setShowAdd(false);
      setForm({ name: "", latitude: "", longitude: "", radius_meters: "200", is_primary: false });
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (loc: GeofenceLocation) => {
    if (!confirm(`Delete geofence "${loc.name}"?`)) return;
    await callEdgeFunction("admin-ops", { action: "delete_geofence", id: loc.id });
    await load();
  };

  const handleToggle = async (loc: GeofenceLocation) => {
    await callEdgeFunction("admin-ops", { action: "upsert_geofence", id: loc.id, name: loc.name, latitude: loc.latitude, longitude: loc.longitude, radius_meters: loc.radius_meters, is_primary: loc.is_primary, enabled: !loc.enabled });
    await load();
  };

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm({ ...form, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }),
      () => setError("Could not get your location")
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Geofence Management</h1>
            <p className="text-sm text-slate-500 mt-1">{locations.length} locations · Students must be inside an active geofence to mark attendance.</p>
          </div>
          <button onClick={() => { setForm({ name: "", latitude: "", longitude: "", radius_meters: "200", is_primary: false }); setShowAdd(true); }} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Location</button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl shimmer-bg" />)}</div>
        ) : locations.length === 0 ? (
          <div className="card p-6"><EmptyState icon={MapPin} title="No geofence locations" subtitle="Add your campus location to enable geofenced attendance." /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((loc, i) => (
              <motion.div key={loc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
                    <div><p className="font-semibold text-slate-900">{loc.name}</p>{loc.is_primary && <span className="text-[10px] text-accent-600 font-semibold">PRIMARY CAMPUS</span>}</div>
                  </div>
                  <span className={`badge ${loc.enabled ? "badge-success" : "badge-error"}`}>{loc.enabled ? "Active" : "Off"}</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500 mb-4">
                  <p><span className="text-slate-400">Lat:</span> {loc.latitude.toFixed(6)}</p>
                  <p><span className="text-slate-400">Lng:</span> {loc.longitude.toFixed(6)}</p>
                  <p><span className="text-slate-400">Radius:</span> {loc.radius_meters}m</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleToggle(loc)} className="btn-secondary flex-1 text-xs"><Power className="w-3.5 h-3.5" /> {loc.enabled ? "Disable" : "Enable"}</button>
                  <button onClick={() => handleDelete(loc)} className="btn-danger p-2"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Geofence Location">
          {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
          <form onSubmit={handleAdd} className="space-y-4">
            <div><label className="label">Location Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Gate, AI & DS Block" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Latitude</label><input type="number" step="any" className="input" required value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="12.9698" /></div>
              <div><label className="label">Longitude</label><input type="number" step="any" className="input" required value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="80.2433" /></div>
            </div>
            <div><label className="label">Allowed Radius (meters)</label><input type="number" className="input" required value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} /> Set as primary campus location</label>
            <button type="button" onClick={useMyLocation} className="btn-secondary w-full"><Navigation className="w-4 h-4" /> Use My Current Location</button>
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Location"}</button>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
