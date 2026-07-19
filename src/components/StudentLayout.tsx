import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { GraduationCap, LayoutDashboard, QrCode, CalendarCheck, User, Bell, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../lib/auth";

const nav = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/student/mark", label: "Mark Attendance", icon: QrCode },
  { to: "/student/history", label: "Attendance History", icon: CalendarCheck },
  { to: "/student/notifications", label: "Notifications", icon: Bell },
  { to: "/student/profile", label: "Profile", icon: User },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { student, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-40 transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-slate-900">DigiAttend</p>
            <p className="text-[10px] text-slate-400">Student Portal</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
              <item.icon className="w-4.5 h-4.5" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
              {student?.profile_picture ? <img src={student.profile_picture} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-primary-700">{student?.full_name?.[0] || "S"}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{student?.full_name}</p>
              <p className="text-[10px] text-slate-400 truncate">{student?.register_number}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="nav-item w-full text-error-600 hover:bg-error-50">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
          <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-slate-100">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <p className="font-display font-bold text-sm">DigiAttend</p>
        </header>
        <main className="p-4 lg:p-8 max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
