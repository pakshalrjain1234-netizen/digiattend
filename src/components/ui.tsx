import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Spinner className="w-8 h-8 text-primary-500" />
    </div>
  );
}

export function Card({ children, className = "", hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={`card ${hover ? "card-hover" : ""} ${className}`}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative card w-full ${sizes[size]} max-h-[90vh] overflow-y-auto scrollbar-thin animate-scale-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-display font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ message, type = "success", onClose }: { message: string; type?: "success" | "error" | "info"; onClose: () => void }) {
  const styles = {
    success: "bg-accent-50 text-accent-700 border-accent-200",
    error: "bg-error-50 text-error-700 border-error-200",
    info: "bg-primary-50 text-primary-700 border-primary-200",
  };
  return (
    <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl border ${styles[type]} shadow-lg animate-slide-up max-w-sm`}>
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="absolute top-1.5 right-2 text-current opacity-50 hover:opacity-100">×</button>
    </div>
  );
}
