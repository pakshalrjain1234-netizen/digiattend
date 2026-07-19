import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { User, Lock, Phone, Camera, Mail, Hash, Building2, GraduationCap, Users, Smartphone, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import StudentLayout from "../../components/StudentLayout";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { getDeviceInfo, getBrowserInfo } from "../../lib/fingerprint";

export default function StudentProfile() {
  const { student, user, refreshProfile } = useAuth();
  const [tab, setTab] = useState<"info" | "security" | "device">("info");
  const [phone, setPhone] = useState(student?.phone || "");
  const [profilePic, setProfilePic] = useState(student?.profile_picture || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(""); setError("");
    try {
      const { error } = await supabase.from("students").update({ phone, profile_picture: profilePic }).eq("id", student!.id);
      if (error) throw new Error(error.message);
      await refreshProfile();
      setMsg("Profile updated successfully.");
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setPwdMsg(""); setPwdErr("");
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: currentPassword });
      if (signInErr) throw new Error("Current password is incorrect");
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw new Error(updateErr.message);
      setPwdMsg("Password changed successfully.");
      setCurrentPassword(""); setNewPassword("");
    } catch (err: any) { setPwdErr(err.message); }
    finally { setSaving(false); }
  };

  const handleUploadPic = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setProfilePic(reader.result as string);
    reader.readAsDataURL(file);
  };

  const deviceInfo = student?.device_info || getDeviceInfo();
  const browserInfo = student?.browser_info || getBrowserInfo();

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your personal information and security.</p>
        </div>

        {/* Profile header */}
        <div className="card p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center overflow-hidden ring-2 ring-primary-200">
                {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl font-bold text-primary-700">{student?.full_name?.[0]}</span>}
              </div>
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 shadow-sm">
                <Camera className="w-3.5 h-3.5 text-slate-600" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadPic(e.target.files[0])} />
              </label>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">{student?.full_name}</h2>
              <p className="text-sm text-slate-500">{student?.register_number} · {student?.department}</p>
              <span className={`badge mt-2 ${student?.status === "active" ? "badge-success" : "badge-error"}`}>{student?.status}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
          {([["info", "Personal Info", User], ["security", "Security", Lock], ["device", "Device", Smartphone]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === key ? "bg-white text-primary-700 shadow-sm" : "text-slate-500"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            {msg && <div className="flex items-center gap-2 bg-accent-50 text-accent-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-accent-200"><CheckCircle2 className="w-4 h-4" /> {msg}</div>}
            {error && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {error}</div>}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Full Name</label><div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-10 opacity-60" value={student?.full_name || ""} disabled /></div></div>
                <div><label className="label">Register Number</label><div className="relative"><Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-10 opacity-60" value={student?.register_number || ""} disabled /></div></div>
                <div><label className="label">Email</label><div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-10 opacity-60" value={student?.email || ""} disabled /></div></div>
                <div><label className="label">Phone Number</label><div className="relative"><Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone number" /></div></div>
                <div><label className="label">Department</label><div className="relative"><Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-10 opacity-60" value={student?.department || ""} disabled /></div></div>
                <div><label className="label">Year</label><div className="relative"><GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-10 opacity-60" value={student?.year || ""} disabled /></div></div>
                <div><label className="label">Section</label><div className="relative"><Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-10 opacity-60" value={student?.section || ""} disabled /></div></div>
              </div>
              <p className="text-xs text-slate-400">Register number, department, year, section, and email cannot be edited. Contact admin for changes.</p>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}</button>
            </form>
          </motion.div>
        )}

        {tab === "security" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            {pwdMsg && <div className="flex items-center gap-2 bg-accent-50 text-accent-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-accent-200"><CheckCircle2 className="w-4 h-4" /> {pwdMsg}</div>}
            {pwdErr && <div className="flex items-center gap-2 bg-error-50 text-error-700 text-sm rounded-xl px-4 py-3 mb-4 ring-1 ring-error-200"><AlertCircle className="w-4 h-4" /> {pwdErr}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div><label className="label">Current Password</label><div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="password" className="input pl-10" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div></div>
              <div><label className="label">New Password</label><div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="password" className="input pl-10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} /></div></div>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Change Password"}</button>
            </form>
          </motion.div>
        )}

        {tab === "device" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center"><Smartphone className="w-5 h-5 text-primary-600" /></div>
              <div><p className="font-semibold text-slate-900">Registered Device</p><p className="text-xs text-slate-400">This device is linked to your account for attendance verification.</p></div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="text-sm text-slate-500">Browser</span><span className="text-sm font-medium text-slate-700">{browserInfo.name} {browserInfo.version}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="text-sm text-slate-500">Operating System</span><span className="text-sm font-medium text-slate-700">{browserInfo.os}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="text-sm text-slate-500">Platform</span><span className="text-sm font-medium text-slate-700">{deviceInfo.platform}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="text-sm text-slate-500">Screen</span><span className="text-sm font-medium text-slate-700">{deviceInfo.screen}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="text-sm text-slate-500">Timezone</span><span className="text-sm font-medium text-slate-700">{deviceInfo.timezone}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="text-sm text-slate-500">Fingerprint</span><span className="text-xs font-mono text-slate-400 max-w-[200px] truncate">{student?.device_fingerprint || "Not registered yet"}</span></div>
            </div>
          </motion.div>
        )}
      </div>
    </StudentLayout>
  );
}
