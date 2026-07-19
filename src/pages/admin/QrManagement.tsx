import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { QrCode, Plus, Download, Printer, Power, RefreshCw, Trash2, Loader2, AlertCircle } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import { Modal, EmptyState } from "../../components/ui";
import type { QrCode as QrCodeType } from "../../lib/types";

export default function QrManagement() {
  const [qrs, setQrs] = useState<QrCodeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: "", label: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("qr_codes").select("*").order("created_at", { ascending: false });
    setQrs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    qrs.forEach((qr) => {
      const canvas = canvasRefs.current.get(qr.id);
      if (canvas) QRCode.toCanvas(canvas, qr.code, { width: 200, margin: 2, color: { dark: "#1e293b" } });
    });
  }, [qrs]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const code = form.code || `DA-${Date.now().toString(36).toUpperCase()}`;
      await callEdgeFunction("admin-ops", { action: "upsert_qr", code, label: form.label, location: form.location, enabled: true });
      setShowAdd(false);
      setForm({ code: "", label: "", location: "" });
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (qr: QrCodeType) => {
    await callEdgeFunction("admin-ops", { action: "upsert_qr", id: qr.id, code: qr.code, label: qr.label, location: qr.location, enabled: !qr.enabled });
    await load();
  };

  const handleRegenerate = async (qr: QrCodeType) => {
    const newCode = `DA-${Date.now().toString(36).toUpperCase()}`;
    await callEdgeFunction("admin-ops", { action: "upsert_qr", id: qr.id, code: newCode, label: qr.label, location: qr.location, enabled: qr.enabled });
    await load();
  };

  const handleDelete = async (qr: QrCodeType) => {
    if (!confirm(`Delete QR code "${qr.label}"?`)) return;
    await callEdgeFunction("admin-ops", { action: "delete_qr", id: qr.id });
    await load();
  };

  const handleDownload = (qr: QrCodeType) => {
    const canvas = canvasRefs.current.get(qr.id);
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${qr.label.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handlePrint = (qr: QrCodeType) => {
    const canvas = canvasRefs.current.get(qr.id);
    if (!canvas) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>QR — ${qr.label}</title></head><body style="text-align:center;padding:40px;font-family:system-ui">
      <h2>${qr.label}</h2><p>${qr.location || ""}</p>
      <img src="${canvas.toDataURL()}" style="width:300px;height:300px"/>
      <p style="font-size:12px;color:#666;margin-top:20px">DigiAttend — MNM Jain Engineering College</p>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">QR Code Management</h1>
            <p className="text-sm text-slate-500 mt-1">{qrs.length} QR codes · {qrs.filter(q => q.enabled).length} active</p>
          </div>
          <button onClick={() => { setForm({ code: "", label: "", location: "" }); setShowAdd(true); }} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Generate QR</button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-64 rounded-2xl shimmer-bg" />)}</div>
        ) : qrs.length === 0 ? (
          <div className="card p-6"><EmptyState icon={QrCode} title="No QR codes yet" subtitle="Generate QR codes for your classrooms." /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {qrs.map((qr, i) => (
              <motion.div key={qr.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div><p className="font-semibold text-slate-900">{qr.label}</p><p className="text-xs text-slate-500">{qr.location || "No location"}</p></div>
                  <span className={`badge ${qr.enabled ? "badge-success" : "badge-error"}`}>{qr.enabled ? "Active" : "Disabled"}</span>
                </div>
                <div className="flex justify-center bg-white rounded-xl p-3 mb-3">
                  <canvas ref={(el) => { if (el) canvasRefs.current.set(qr.id, el); }} />
                </div>
                <p className="text-xs font-mono text-slate-400 text-center mb-3 truncate">{qr.code}</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleDownload(qr)} className="btn-secondary flex-1 text-xs"><Download className="w-3.5 h-3.5" /> Download</button>
                  <button onClick={() => handlePrint(qr)} className="btn-secondary flex-1 text-xs"><Printer className="w-3.5 h-3.5" /> Print</button>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button onClick={() => handleToggle(qr)} className="btn-secondary flex-1 text-xs"><Power className="w-3.5 h-3.5" /> {qr.enabled ? "Disable" : "Enable"}</button>
                  <button onClick={() => handleRegenerate(qr)} className="btn-secondary p-2" title="Regenerate"><RefreshCw className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(qr)} className="btn-danger p-2" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                
              </motion.div>
            ))}
          </div>
        )}

        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Generate QR Code">
          {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
          <form onSubmit={handleAdd} className="space-y-4">
            <div><label className="label">Label (Classroom Name)</label><input className="input" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Room 101 — AI & DS Block" /></div>
            <div><label className="label">Location (Optional)</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Ground Floor" /></div>
            <div><label className="label">Code (Optional)</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Auto-generated if left blank" /></div>
            <p className="text-xs text-slate-400">Static QR codes are permanent. Dynamic QR (rotating tokens) is reserved for a future release.</p>
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate QR Code"}</button>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
