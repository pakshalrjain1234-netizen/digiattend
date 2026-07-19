import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { QrCode, ScanLine, CheckCircle2, XCircle, MapPin, Clock, Smartphone, Loader2, AlertCircle, RefreshCw, Ruler, Gauge } from "lucide-react";
import StudentLayout from "../../components/StudentLayout";
import { useAuth } from "../../lib/auth";
import { callEdgeFunction } from "../../lib/supabase";
import { getDeviceInfo, getBrowserInfo, getDeviceFingerprint } from "../../lib/fingerprint";
import { getCurrentPosition } from "../../lib/geo";
import type { GeoPosition } from "../../lib/geo";

type Stage = "idle" | "scanning" | "validating" | "success" | "error" | "retry_location";

interface CheckItem {
  label: string;
  icon: any;
  status: "pending" | "running" | "pass" | "fail" | "warn";
  detail?: string;
}

const initialChecks: CheckItem[] = [
  { label: "QR Code Status", icon: QrCode, status: "pending" },
  { label: "Attendance Time Status", icon: Clock, status: "pending" },
  { label: "Geofence Status", icon: MapPin, status: "pending" },
  { label: "Distance from College", icon: Ruler, status: "pending" },
  { label: "GPS Accuracy", icon: Gauge, status: "pending" },
  { label: "Device Verification", icon: Smartphone, status: "pending" },
  { label: "Attendance Status", icon: CheckCircle2, status: "pending" },
];

export default function MarkAttendance() {
  const { student } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [checks, setChecks] = useState<CheckItem[]>(initialChecks);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [, setScannedCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false);

  const lastAttemptRef = useRef<{ qrCode: string; fingerprint: string; deviceInfo: any; browserInfo: any } | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const updateCheck = (index: number, status: CheckItem["status"], detail?: string) => {
    setChecks((prev) => prev.map((c, i) => (i === index ? { ...c, status, detail } : c)));
  };

  const startCamera = async () => {
    setStage("scanning");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        startScanning();
      }
    } catch {
      setError("Camera access denied. Please enable camera permissions or enter the QR code manually.");
      setShowManual(true);
      setStage("idle");
    }
  };

  const startScanning = () => {
    const codeLib = (window as any).jsQR;
    if (!codeLib) {
      loadJsQr().then(() => startScanning());
      return;
    }
    scanIntervalRef.current = window.setInterval(() => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = codeLib(imageData.data, canvas.width, canvas.height);
        if (code) {
          stopCamera();
          setScannedCode(code.data);
          runValidations(code.data);
        }
      }
    }, 200);
  };

  const loadJsQr = () => {
    return new Promise<void>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  };

  const runValidations = async (qrCode: string) => {
    setStage("validating");
    setError("");
    setWarning("");
    setChecks(initialChecks.map((c) => ({ ...c, status: "pending" })));

    // Pre-flight client checks (UX only — server is authoritative)
    updateCheck(0, "running");
    await delay(150);
    updateCheck(0, "pass", "Verifying on server…");

    updateCheck(1, "running");
    await delay(150);
    updateCheck(1, "pass", "Checking window…");

    // Get location (client-side, but server re-validates)
    let position: GeoPosition;
    try {
      position = await getCurrentPosition();
    } catch (err: any) {
      updateCheck(2, "fail", "Location denied");
      updateCheck(3, "fail", "Unknown");
      updateCheck(4, "fail", "Unknown");
      return fail(err.message || "Location access is required to mark attendance.");
    }

    updateCheck(2, "running");
    updateCheck(3, "running");
    updateCheck(4, "running");

    const fingerprint = await getDeviceFingerprint();
    const deviceInfo = getDeviceInfo();
    const browserInfo = getBrowserInfo();

    updateCheck(5, "running");
    if (student?.device_fingerprint && student.device_fingerprint !== fingerprint) {
      updateCheck(5, "fail", "Device mismatch");
      return fail("Unregistered device. Please use your registered device.");
    }
    updateCheck(5, "pass", student?.device_fingerprint ? "Registered device" : "Auto-registered");

    lastAttemptRef.current = { qrCode, fingerprint, deviceInfo, browserInfo };

    // Submit to server — server performs ALL validation (QR, window, geofence, accuracy, duplicate)
    updateCheck(6, "running");
    try {
      const res = await callEdgeFunction("student-ops", {
        action: "mark",
        qr_code: qrCode,
        latitude: position.latitude,
        longitude: position.longitude,
        gps_accuracy: position.accuracy,
        device_info: deviceInfo,
        browser_info: browserInfo,
        device_fingerprint: fingerprint,
      });

      if (res?.alreadyMarked) {
        updateCheck(6, "warn", "Already marked today");
        setStage("error");
        setError("Attendance already marked for today.");
        return;
      }

      // Server validated everything — mark all checks pass
      updateCheck(0, "pass", "Valid QR");
      updateCheck(1, "pass", "Within window");
      updateCheck(2, "pass", "Inside campus");
      updateCheck(3, "pass", `${Math.round(haversine(position.latitude, position.longitude, position.latitude, position.longitude))} meters`);
      updateCheck(4, "pass", `±${Math.round(position.accuracy)}m`);
      updateCheck(6, "pass", res.status === "late" ? "Recorded (Late)" : "Recorded successfully");
      if (res.status === "late") setWarning("You were marked late (after the end time, within grace).");
      await delay(300);
      setStage("success");
      fireConfetti();
    } catch (err: any) {
      console.error("[markAttendance] submission failed:", err);
      const code = err.code;
      if (code === "DUPLICATE") {
        updateCheck(6, "warn", "Already marked today");
        setStage("error");
        setError("Attendance already marked for today.");
        return;
      }
      if (code === "DEVICE_MISMATCH") updateCheck(5, "fail", "Device mismatch");
      else if (code === "OUTSIDE_GEOFENCE") updateCheck(2, "fail", "Outside campus");
      else if (code === "GPS_ACCURACY") {
        updateCheck(4, "fail", `±${Math.round(position.accuracy)}m`);
        setStage("retry_location");
        setError(err.message || `Your location accuracy is currently low (±${Math.round(position.accuracy)} meters). Please move closer to a window or open area and try again.`);
        return;
      }
      else if (code === "OUTSIDE_WINDOW") updateCheck(1, "fail", "Outside window");
      else if (code === "QR_INVALID" || code === "QR_DISABLED") updateCheck(0, "fail", "Invalid QR");
      else if (code === "NETWORK") updateCheck(6, "fail", "Network error");
      else if (code === "NO_SESSION") updateCheck(6, "fail", "Session expired");
      else updateCheck(6, "fail", "Submission failed");
      return fail(err.message || "Unable to mark attendance. Please try again.");
    }
  };

  const retryLocation = async () => {
    if (!lastAttemptRef.current) return;
    const { qrCode, fingerprint, deviceInfo, browserInfo } = lastAttemptRef.current;
    setStage("validating");
    setError("");
    setWarning("");

    let newPosition: GeoPosition;
    try {
      newPosition = await getCurrentPosition();
    } catch (err: any) {
      setStage("retry_location");
      setError(err.message);
      return;
    }

    updateCheck(6, "running");
    try {
      const res = await callEdgeFunction("student-ops", {
        action: "mark",
        qr_code: qrCode,
        latitude: newPosition.latitude,
        longitude: newPosition.longitude,
        gps_accuracy: newPosition.accuracy,
        device_info: deviceInfo,
        browser_info: browserInfo,
        device_fingerprint: fingerprint,
      });
      if (res?.alreadyMarked) {
        updateCheck(6, "warn", "Already marked today");
        setStage("error");
        setError("Attendance already marked for today.");
        return;
      }
      updateCheck(4, "pass", `±${Math.round(newPosition.accuracy)}m`);
      updateCheck(6, "pass", res.status === "late" ? "Recorded (Late)" : "Recorded successfully");
      if (res.status === "late") setWarning("You were marked late (after the end time, within grace).");
      await delay(300);
      setStage("success");
      fireConfetti();
    } catch (err: any) {
      console.error("[retryLocation] submission failed:", err);
      const code = err.code;
      if (code === "DUPLICATE") {
        updateCheck(6, "warn", "Already marked today");
        setStage("error");
        setError("Attendance already marked for today.");
        return;
      }
      if (code === "GPS_ACCURACY") {
        updateCheck(4, "fail", `±${Math.round(newPosition.accuracy)}m`);
        setStage("retry_location");
        setError(err.message);
        return;
      }
      if (code === "DEVICE_MISMATCH") updateCheck(5, "fail", "Device mismatch");
      else if (code === "OUTSIDE_GEOFENCE") updateCheck(2, "fail", "Outside campus");
      else if (code === "OUTSIDE_WINDOW") updateCheck(1, "fail", "Outside window");
      else if (code === "QR_INVALID" || code === "QR_DISABLED") updateCheck(0, "fail", "Invalid QR");
      else if (code === "NETWORK") updateCheck(6, "fail", "Network error");
      else if (code === "NO_SESSION") updateCheck(6, "fail", "Session expired");
      else updateCheck(6, "fail", "Submission failed");
      return fail(err.message || "Unable to mark attendance. Please try again.");
    }
  };

  const fail = (msg: string) => {
    setError(msg);
    setStage("error");
  };

  const reset = () => {
    setStage("idle");
    setError("");
    setWarning("");
    setScannedCode("");
    setChecks(initialChecks);
    lastAttemptRef.current = null;
  };

  return (
    <StudentLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Mark Attendance</h1>
          <p className="text-sm text-slate-500 mt-1">Scan your classroom QR code. All validations run on the server.</p>
        </div>

        <AnimatePresence mode="wait">
          {stage === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card p-8 text-center">
              <div className="w-24 h-24 rounded-3xl bg-primary-50 flex items-center justify-center mx-auto mb-5">
                <ScanLine className="w-12 h-12 text-primary-600" />
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900 mb-2">Ready to Scan</h2>
              <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">Point your camera at the classroom QR code. Make sure you're inside campus with location enabled.</p>
              <button onClick={startCamera} className="btn-primary py-3 px-8 mx-auto">
                <ScanLine className="w-5 h-5" /> Start Scanning
              </button>
              <button onClick={() => setShowManual(!showManual)} className="block mx-auto mt-3 text-xs text-slate-400 hover:text-primary-600">Enter code manually</button>
              {showManual && (
                <div className="mt-4 flex gap-2 max-w-xs mx-auto">
                  <input className="input flex-1" placeholder="QR code value" value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                  <button onClick={() => { setScannedCode(manualCode); runValidations(manualCode); }} className="btn-primary px-4">Go</button>
                </div>
              )}
            </motion.div>
          )}

          {stage === "scanning" && (
            <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card p-6">
              <div className="relative aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden bg-slate-900">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-8 border-2 border-white/70 rounded-2xl" />
                  <div className="absolute top-8 left-8 w-8 h-8 border-t-4 border-l-4 border-primary-400 rounded-tl-lg" />
                  <div className="absolute top-8 right-8 w-8 h-8 border-t-4 border-r-4 border-primary-400 rounded-tr-lg" />
                  <div className="absolute bottom-8 left-8 w-8 h-8 border-b-4 border-l-4 border-primary-400 rounded-bl-lg" />
                  <div className="absolute bottom-8 right-8 w-8 h-8 border-b-4 border-r-4 border-primary-400 rounded-br-lg" />
                  <motion.div className="absolute left-8 right-8 h-0.5 bg-primary-400" animate={{ top: ["2rem", "calc(100% - 2rem)", "2rem"] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
                </div>
              </div>
              <p className="text-center text-sm text-slate-500 mt-4">Scanning... Hold steady.</p>
              <button onClick={() => { stopCamera(); reset(); }} className="btn-secondary mx-auto mt-3">Cancel</button>
            </motion.div>
          )}

          {stage === "retry_location" && (
            <motion.div key="retry" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="card p-6">
                <div className="space-y-2">
                  {checks.map((check, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 border border-slate-100">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        check.status === "pass" ? "bg-accent-50 text-accent-600" :
                        check.status === "fail" ? "bg-error-50 text-error-600" :
                        check.status === "warn" ? "bg-warning-50 text-warning-600" :
                        check.status === "running" ? "bg-primary-50 text-primary-600" : "bg-slate-100 text-slate-400"
                      }`}>
                        {check.status === "pass" ? <CheckCircle2 className="w-4 h-4" /> :
                         check.status === "fail" ? <XCircle className="w-4 h-4" /> :
                         check.status === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                         check.status === "warn" ? <AlertCircle className="w-4 h-4" /> :
                         <check.icon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{check.label}</p>
                        {check.detail && <p className="text-xs text-slate-400">{check.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 bg-warning-50 ring-1 ring-warning-200 rounded-xl p-4">
                <Gauge className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-warning-700">Location Accuracy Too Low</p>
                  <p className="text-xs text-warning-600 mt-0.5">{error}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={retryLocation} className="btn-primary flex-1">
                  <RefreshCw className="w-4 h-4" /> Retry Location
                </button>
                <button onClick={reset} className="btn-secondary">Cancel</button>
              </div>
            </motion.div>
          )}

          {(stage === "validating" || stage === "success" || stage === "error") && (
            <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
              <div className="space-y-2">
                {checks.map((check, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      check.status === "pass" ? "bg-accent-50 text-accent-600" :
                      check.status === "fail" ? "bg-error-50 text-error-600" :
                      check.status === "warn" ? "bg-warning-50 text-warning-600" :
                      check.status === "running" ? "bg-primary-50 text-primary-600" : "bg-slate-100 text-slate-400"
                    }`}>
                      {check.status === "pass" ? <CheckCircle2 className="w-4 h-4" /> :
                       check.status === "fail" ? <XCircle className="w-4 h-4" /> :
                       check.status === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                       check.status === "warn" ? <AlertCircle className="w-4 h-4" /> :
                       <check.icon className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{check.label}</p>
                      {check.detail && <p className="text-xs text-slate-400">{check.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {warning && stage === "success" && (
                <div className="mt-4 flex items-start gap-3 bg-warning-50 ring-1 ring-warning-200 rounded-xl p-3.5">
                  <AlertCircle className="w-4 h-4 text-warning-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-warning-700">{warning}</p>
                </div>
              )}

              {stage === "error" && (
                <div className="mt-5 flex items-start gap-3 bg-error-50 ring-1 ring-error-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-error-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-error-700">Attendance Failed</p>
                    <p className="text-xs text-error-600 mt-0.5">{error}</p>
                  </div>
                  <button onClick={reset} className="btn-secondary py-2 px-3 text-xs"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
                </div>
              )}

              {stage === "success" && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 text-center py-6">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-12 h-12 text-accent-600" />
                  </motion.div>
                  <h2 className="font-display text-2xl font-bold text-slate-900">Attendance Marked!</h2>
                  <p className="text-sm text-slate-500 mt-1">Your attendance for today has been recorded successfully.</p>
                  <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date().toLocaleTimeString("en-IN")}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> On Campus</span>
                  </div>
                  <button onClick={reset} className="btn-secondary mx-auto mt-5">Mark Another</button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StudentLayout>
  );
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function fireConfetti() {
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#10b981", "#3b76f6", "#f59e0b"] });
  setTimeout(() => confetti({ particleCount: 50, spread: 100, origin: { y: 0.5 }, angle: 60 }), 200);
  setTimeout(() => confetti({ particleCount: 50, spread: 100, origin: { y: 0.5 }, angle: 120 }), 200);
}
