import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileSpreadsheet, FileText, Loader2, CheckCircle2, AlertCircle, Download, X, History, ArrowRight } from "lucide-react";
import { Modal } from "../../components/ui";
import { callEdgeFunction } from "../../lib/supabase";
import { parseImportFile, downloadCsv } from "../../lib/export";

interface ImportFailure {
  row: number;
  register_number: string;
  full_name: string;
  email: string;
  reason: string;
  category: "validation" | "duplicate" | "auth" | "db" | "role";
}

interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  duplicates: number;
  validation_errors: number;
  auth_errors: number;
  failures: ImportFailure[];
}

interface ImportHistoryEntry {
  actor: string;
  created_at: string;
  detail: { total: number; imported: number; failed: number; duplicates: number } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Phase = "upload" | "parsing" | "preview" | "importing" | "done";

export default function ImportStudents({ open, onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPhase("upload");
      setFile(null);
      setParsedRows([]);
      setError("");
      setProgress(0);
      setResult(null);
    }
  }, [open]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await callEdgeFunction("admin-ops", { action: "import_history" });
      setHistory(res.history || []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  const handleFile = useCallback(async (f: File) => {
    setError("");
    setFile(f);
    setPhase("parsing");
    try {
      const rows = await parseImportFile(f);
      if (rows.length === 0) {
        setError("The file is empty or has no data rows.");
        setPhase("upload");
        return;
      }
      setParsedRows(rows);
      setPhase("preview");
    } catch (err: any) {
      setError(err.message || "Failed to parse file.");
      setPhase("upload");
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const normalizedRows = parsedRows.map((d) => ({
    register_number: String(d.register_number || d.Register || d["Register Number"] || "").trim(),
    full_name: String(d.full_name || d.Name || d["Full Name"] || "").trim(),
    email: String(d.email || d.Email || "").trim(),
    department: String(d.department || d.Department || d.Dept || "").trim(),
    year: String(d.year || d.Year || "1").replace(/\.0$/, "").trim(),
    section: String(d.section || d.room || d.Room || d["Room Number"] || d.Section || "").replace(/\.0$/, "").trim(),
    phone: String(d.phone || d.Phone || "").trim(),
    password: String(d.password || d.Password || d.register_number || d.Register || "").trim(),
  }));

  const validRows = normalizedRows.filter((r) => r.register_number && r.full_name && r.email);
  const invalidCount = normalizedRows.length - validRows.length;

  const handleImport = async () => {
    setPhase("importing");
    setProgress(0);
    setError("");
    setResult(null);

    // Animate progress while the server processes
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 5, 90));
    }, 200);

    try {
      const res = await callEdgeFunction("admin-ops", {
        action: "import_students",
        students: normalizedRows,
      });
      clearInterval(interval);
      setProgress(100);
      setResult(res as ImportResult);
      setPhase("done");
      onComplete();
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Import failed.");
      setPhase("preview");
    }
  };

  const downloadFailed = () => {
    if (!result?.failures?.length) return;
    downloadCsv(
      `failed-imports-${new Date().toISOString().slice(0, 10)}.csv`,
      result.failures.map((f) => ({
        Row: f.row,
        Register_Number: f.register_number,
        Full_Name: f.full_name,
        Email: f.email,
        Reason: f.reason,
        Category: f.category,
      })),
    );
  };

  const downloadTemplate = () => {
    downloadCsv("student-import-template.csv", [
      {
        "Register Number": "MNM21ADS001",
        "Full Name": "John Doe",
        Email: "john@gmail.com",
        Department: "AI & DS",
        Year: "1",
        Section: "301",
        Phone: "9876543210",
        Password: "",
      },
    ]);
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Students" size="lg">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Upload an Excel (.xlsx) or CSV (.csv) file. Supported columns: Register Number, Full Name, Email, Department, Year, Section/Room, Phone, Password.</p>
          <button onClick={() => setShowHistory((s) => !s)} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
            <History className="w-3.5 h-3.5" /> History
          </button>
        </div>

        {showHistory && (
          <div className="card p-4 max-h-48 overflow-y-auto scrollbar-thin">
            {history.length === 0 ? (
              <p className="text-xs text-slate-400 text-center">No import history yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2 last:border-0">
                    <span className="text-slate-600">{new Date(h.created_at).toLocaleString("en-IN")} · {h.actor}</span>
                    {h.detail && <span className="text-slate-500">{h.detail.imported} imported, {h.detail.failed} failed, {h.detail.duplicates} duplicates</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-primary-400 hover:bg-slate-50"
                }`}
              >
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onPick} />
                <UploadCloud className="w-12 h-12 text-primary-500 mx-auto mb-3" />
                <p className="font-semibold text-slate-700">Drag & drop your file here</p>
                <p className="text-sm text-slate-400 mt-1">or click to browse — .xlsx, .xls, .csv</p>
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><FileSpreadsheet className="w-4 h-4" /> Excel</span>
                  <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> CSV</span>
                </div>
              </div>
              {error && <div className="mt-3 flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
              <button onClick={downloadTemplate} className="mt-3 text-xs text-primary-600 hover:underline flex items-center gap-1 mx-auto">
                <Download className="w-3.5 h-3.5" /> Download CSV template
              </button>
            </motion.div>
          )}

          {phase === "parsing" && (
            <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-10 text-center">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Parsing file…</p>
            </motion.div>
          )}

          {phase === "preview" && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="w-5 h-5 text-accent-600" />
                  <span className="font-medium text-slate-700">{file?.name}</span>
                  <span className="text-slate-400">· {parsedRows.length} rows</span>
                </div>
                <button onClick={() => { setPhase("upload"); setFile(null); setParsedRows([]); }} className="text-xs text-slate-500 hover:text-error-600 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Change file
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="card p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{parsedRows.length}</p>
                  <p className="text-xs text-slate-500">Total Records</p>
                </div>
                <div className="card p-3 text-center">
                  <p className="text-2xl font-bold text-accent-600">{validRows.length}</p>
                  <p className="text-xs text-slate-500">Valid</p>
                </div>
                <div className="card p-3 text-center">
                  <p className="text-2xl font-bold text-warning-600">{invalidCount}</p>
                  <p className="text-xs text-slate-500">Missing Fields</p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin max-h-64">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Register</th>
                        <th className="px-3 py-2 font-semibold">Name</th>
                        <th className="px-3 py-2 font-semibold">Email</th>
                        <th className="px-3 py-2 font-semibold">Dept</th>
                        <th className="px-3 py-2 font-semibold">Year</th>
                        <th className="px-3 py-2 font-semibold">Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedRows.slice(0, 100).map((r, i) => {
                        const valid = !!(r.register_number && r.full_name && r.email);
                        return (
                          <tr key={i} className={`border-b border-slate-100 ${valid ? "" : "bg-warning-50"}`}>
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{r.register_number || <span className="text-error-500">—</span>}</td>
                            <td className="px-3 py-2 text-slate-700">{r.full_name || <span className="text-error-500">—</span>}</td>
                            <td className="px-3 py-2 text-slate-600">{r.email || <span className="text-error-500">—</span>}</td>
                            <td className="px-3 py-2 text-slate-600">{r.department}</td>
                            <td className="px-3 py-2 text-slate-600">{r.year}</td>
                            <td className="px-3 py-2 text-slate-600">{r.section}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 100 && <p className="text-xs text-slate-400 text-center py-2">Showing first 100 of {parsedRows.length} rows</p>}
              </div>

              {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}

              <div className="flex gap-3">
                <button onClick={handleImport} disabled={validRows.length === 0} className="btn-primary flex-1">
                  <UploadCloud className="w-4 h-4" /> Import {validRows.length} Students
                </button>
                <button onClick={() => { setPhase("upload"); setFile(null); setParsedRows([]); }} className="btn-secondary">Cancel</button>
              </div>
              <p className="text-xs text-slate-400">Duplicates and invalid rows will be skipped automatically. A detailed report will appear after import.</p>
            </motion.div>
          )}

          {phase === "importing" && (
            <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-700">Importing students…</p>
              <div className="max-w-sm mx-auto">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-primary-500 to-accent-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.2 }} />
                </div>
                <p className="text-xs text-slate-400 mt-2">{progress}%</p>
              </div>
            </motion.div>
          )}

          {phase === "done" && result && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }} className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-10 h-10 text-accent-600" />
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">Import Complete</h3>
                <p className="text-sm text-slate-500 mt-1">{result.imported} of {result.total} students imported successfully.</p>
              </motion.div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SummaryCard label="Total Records" value={result.total} color="slate" />
                <SummaryCard label="Imported" value={result.imported} color="accent" />
                <SummaryCard label="Failed" value={result.failed} color="error" />
                <SummaryCard label="Duplicates" value={result.duplicates} color="warning" />
                <SummaryCard label="Validation Errors" value={result.validation_errors} color="warning" />
                <SummaryCard label="Auth Errors" value={result.auth_errors} color="error" />
              </div>

              {result.failures.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-700">Failed Records ({result.failures.length})</p>
                    <button onClick={downloadFailed} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> Download CSV</button>
                  </div>
                  <div className="overflow-x-auto scrollbar-thin max-h-56">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                          <th className="px-3 py-2 font-semibold">Row</th>
                          <th className="px-3 py-2 font-semibold">Register</th>
                          <th className="px-3 py-2 font-semibold">Name</th>
                          <th className="px-3 py-2 font-semibold">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.failures.map((f, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-3 py-2 text-slate-400">{f.row}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{f.register_number || "—"}</td>
                            <td className="px-3 py-2 text-slate-700">{f.full_name || "—"}</td>
                            <td className="px-3 py-2 text-error-600">{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setPhase("upload"); setFile(null); setParsedRows([]); setResult(null); }} className="btn-secondary flex-1">
                  Import Another File
                </button>
                <button onClick={onClose} className="btn-primary flex-1">
                  Done <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    slate: "text-slate-900",
    accent: "text-accent-600",
    error: "text-error-600",
    warning: "text-warning-600",
  };
  return (
    <div className="card p-3 text-center">
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
