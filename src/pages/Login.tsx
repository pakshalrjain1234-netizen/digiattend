import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Shield, Mail, Lock, Hash, ArrowRight, AlertCircle, Loader2, CalendarCheck, MapPin, QrCode } from "lucide-react";
import { supabase, callPublicFunction } from "../lib/supabase";
import { useAuth } from "../lib/auth";

type Portal = "student" | "admin";
type LoginMode = "email" | "register";

export default function Login() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal>("student");
  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adminSetup, setAdminSetup] = useState(false);
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupMsg, setSetupMsg] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (portal === "student") {
        let loginEmail = email;
        if (mode === "register") {
          if (!registerNumber || !password) throw new Error("Register number and password are required");
          const res = await callPublicFunction("student-login", { register_number: registerNumber, password });
          loginEmail = res.email;
        }
        if (!loginEmail || !password) throw new Error("Email and password are required");
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (signInError) throw new Error(signInError.message);
        await refreshProfile();
        navigate("/student");
      } else {
        if (!email || !password) throw new Error("Admin email and password are required");
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error(signInError.message);
        await refreshProfile();
        navigate("/admin");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setSetupMsg("");
    setLoading(true);
    try {
      const res = await callPublicFunction("admin-bootstrap", { email: setupEmail, password: setupPassword });
      if (!res.success) throw new Error(res.error || "Setup failed");
      setSetupMsg("Admin account created. You can now sign in.");
      setAdminSetup(false);
    } catch (err: any) {
      setSetupMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent-400 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">DigiAttend</h1>
              <p className="text-xs text-primary-200">MNM Jain Engineering College</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl lg:text-4xl font-bold leading-tight mb-4">
            Smart, secure attendance for a smarter campus.
          </motion.h2>
          <p className="text-primary-200 text-sm lg:text-base mb-8 leading-relaxed">
            QR-based whole-day attendance with GPS geofencing, device verification, and fraud detection — built for reliability and trust.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: QrCode, label: "QR Attendance" },
              { icon: MapPin, label: "GPS Geofencing" },
              { icon: Shield, label: "Fraud Detection" },
              { icon: CalendarCheck, label: "Live Reports" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 bg-white/5 backdrop-blur rounded-xl px-3.5 py-2.5 ring-1 ring-white/10">
                <f.icon className="w-4 h-4 text-accent-300" />
                <span className="text-xs font-medium text-primary-100">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-primary-300">
          © {new Date().getFullYear()} MNM Jain Engineering College. All rights reserved.
        </div>
      </div>

      {/* Right form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-slate-50">
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h2 className="font-display text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500">Sign in to your portal to continue.</p>
          </motion.div>

          {/* Portal toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setPortal("student")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${portal === "student" ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <GraduationCap className="w-4 h-4" /> Student
            </button>
            <button
              type="button"
              onClick={() => setPortal("admin")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${portal === "admin" ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Shield className="w-4 h-4" /> Admin
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {portal === "student" && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button type="button" onClick={() => setMode("email")} className={`py-2 rounded-lg text-xs font-semibold transition-all ${mode === "email" ? "bg-white text-primary-700 shadow-sm" : "text-slate-500"}`}>
                  Email Login
                </button>
                <button type="button" onClick={() => setMode("register")} className={`py-2 rounded-lg text-xs font-semibold transition-all ${mode === "register" ? "bg-white text-primary-700 shadow-sm" : "text-slate-500"}`}>
                  Register No. Login
                </button>
              </div>
            )}

            {portal === "student" && mode === "register" ? (
              <div>
                <label className="label">Register Number</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input className="input pl-10" value={registerNumber} onChange={(e) => setRegisterNumber(e.target.value)} placeholder="e.g. 21CS001" />
                </div>
              </div>
            ) : (
              <div>
                <label className="label">{portal === "admin" ? "Admin Email" : "College Email"}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mnmjec.ac.in" />
                </div>
              </div>
            )}

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" className="input pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          {portal === "admin" && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              {adminSetup ? (
                <form onSubmit={handleSetupAdmin} className="space-y-3">
                  <p className="text-xs font-semibold text-slate-600">First-time admin setup</p>
                  <input className="input" type="email" placeholder="Admin email" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} />
                  <input className="input" type="password" placeholder="Admin password (min 6 chars)" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} />
                  <button type="submit" disabled={loading} className="btn-secondary w-full py-2.5">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Admin Account"}
                  </button>
                  {setupMsg && <p className="text-xs text-accent-600">{setupMsg}</p>}
                </form>
              ) : (
                <button onClick={() => setAdminSetup(true)} className="text-xs text-slate-400 hover:text-primary-600 transition-colors">
                  First-time admin? Set up admin account →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
