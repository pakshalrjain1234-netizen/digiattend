import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Role, Student } from "./types";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: Role | null;
  student: Student | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, session: null, role: null, student: null, loading: true,
  });

  const loadProfile = async (userId: string) => {
    const { data: roleRow } = await supabase
      .from("user_roles").select("role, student_id").eq("user_id", userId).maybeSingle();
    let student: Student | null = null;
    if (roleRow?.role === "student" && roleRow.student_id) {
      const { data: s } = await supabase.from("students").select("*").eq("id", roleRow.student_id).maybeSingle();
      student = s as Student;
    }
    setState((prev) => ({ ...prev, role: (roleRow?.role as Role) || null, student }));
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      setState((prev) => ({ ...prev, session, user: session?.user ?? null, loading: false }));
      if (session?.user) {
        loadProfile(session.user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!mounted) return;
        setState((prev) => ({ ...prev, session, user: session?.user ?? null, loading: false }));
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setState((prev) => ({ ...prev, role: null, student: null }));
        }
      })();
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, role: null, student: null, loading: false });
  };

  const refreshProfile = async () => {
    if (state.user) await loadProfile(state.user.id);
  };

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
