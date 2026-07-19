import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Shield, LayoutDashboard, Users, QrCode, MapPin, CalendarCheck, FileBarChart, AlertTriangle, Bell, Settings, History, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../lib/auth";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/qr", label: "QR Codes", icon: QrCode },
  { to: "/admin/geofence", label: "Geofence", icon: MapPin },
  { to: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/defaulters", label: "Defaulters", icon: AlertTriangle },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/audit", label: "Audit Logs", icon: History },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-primary-950 text-slate-300 flex flex-col z-40 transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-white">DigiAttend</p>
            <p className="text-[10px] text-primary-300">Admin Console</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${isActive ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30" : "text-primary-200 hover:bg-primary-900/60 hover:text-white"}`}>
              <item.icon className="w-4.5 h-4.5" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
              <p className="text-[10px] text-primary-300">Administrator</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-primary-200 hover:bg-error-600/20 hover:text-error-300 w-full transition-all">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 h-14 bg-primary-950 text-white border-b border-white/10 flex items-center px-4 gap-3">
          <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-white/10">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <p className="font-display font-bold text-sm">Admin Console</p>
        </header>
        <main className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
