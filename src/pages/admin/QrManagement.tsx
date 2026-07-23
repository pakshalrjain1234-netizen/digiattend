import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, QrCode, Loader2, Printer } from "lucide-react";
import QRCode from "qrcode.react";
import AdminLayout from "../../components/AdminLayout";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import { EmptyState } from "../../components/ui";
import type { QR } from "../../lib/types";

export default function QrManagement() {
  const [qrs, setQrs] = useState<QR[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: "", location: "", code: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printQR, setPrintQR] = useState<{ code: string; label: string } | null>(null);

  useEffect(() => {
    fetchQrs();
  }, []);

  const fetchQrs = async () => {
    const { data } = await supabase.from("qr_codes").select("*").order("created_at", { ascending: false });
    setQrs(data || []);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: any = { action: "upsert_qr", label: form.label, location: form.location };
      if (form.code) payload.code = form.code;
      await callEdgeFunction("admin-ops", payload);
      setSuccess("QR code saved successfully.");
      setForm({ label: "", location: "", code: "" });
      fetchQrs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this QR code?")) return;
    try {
      await callEdgeFunction("admin-ops", { action: "delete_qr", id });
      fetchQrs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePrint = (code: string, label: string) => {
    setPrintQR({ code, label });
    // Allow DOM to update, then trigger print
    setTimeout(() => {
      window.print();
      // Reset after printing (optional)
      setTimeout(() => setPrintQR(null), 500);
    }, 200);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">QR Codes</h1>
          <p className="text-sm text-slate-500 mt-1">Generate and manage static QR codes for attendance.</p>
        </div>

        {/* -------- Inline Print Styles -------- */}
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            .print-area,
            .print-area * {
              visibility: visible !important;
            }
            .print-area {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: 100% !important;
              background: white !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              z-index: 9999 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* -------- Form (no-print) -------- */}
          <div className="card p-6 no-print">
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Label (Classroom Name)</label>
                <input
                  className="input"
                  required
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. CLASS 143"
                />
              </div>
              <div>
                <label className="label">Location (Optional)</label>
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Ground Floor"
                />
              </div>
              <div>
                <label className="label">Code (Optional – auto‑generated if left blank)</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Leave blank for auto‑generate"
                />
              </div>
              {error && <div className="text-error-600 text-sm">{error}</div>}
              {success && <div className="text-accent-600 text-sm">{success}</div>}
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? "Saving..." : "Generate QR Code"}
              </button>
            </form>

            {/* Preview (only if code exists) */}
            {form.code && (
              <div className="mt-6 p-4 border rounded-xl bg-slate-50 flex flex-col items-center">
                <p className="text-xs text-slate-500 mb-2">Preview</p>
                <QRCode value={form.code} size={120} level="H" includeMargin />
                <p className="text-xs text-slate-400 mt-2">{form.code}</p>
              </div>
            )}
          </div>

          {/* -------- List of QR Codes (no-print) -------- */}
          <div className="card p-6 no-print">
            <h2 className="font-display font-semibold text-slate-900 mb-4">Existing QR Codes</h2>
            {loading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer-bg" />)}</div>
            ) : qrs.length === 0 ? (
              <EmptyState icon={QrCode} title="No QR codes yet" />
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {qrs.map((qr) => (
                  <div key={qr.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center p-1">
                        <QRCode value={qr.code} size={48} level="H" includeMargin />
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">{qr.label}</p>
                        <p className="text-xs text-slate-400">{qr.location || "No location"}</p>
                        <p className="text-[10px] text-slate-300 font-mono">{qr.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrint(qr.code, qr.label)}
                        className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                        title="Print QR"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(qr.id)}
                        className="p-2 text-slate-400 hover:text-error-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* -------- Hidden Print Area (only visible during print) -------- */}
      {printQR && (
        <div className="print-area">
          <h2 className="text-3xl font-bold text-slate-800 mb-6">Scan to Mark Attendance</h2>
          <QRCode value={printQR.code} size={350} level="H" includeMargin />
          <p className="text-sm text-slate-500 mt-6 font-mono">{printQR.code}</p>
          <p className="text-xs text-slate-400 mt-2">{printQR.label}</p>
          <p className="absolute bottom-8 text-xs text-slate-400">DigiAttend QR Code</p>
        </div>
      )}
    </AdminLayout>
  );
}
