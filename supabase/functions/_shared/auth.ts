import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2.57.4";
import { errorResponse } from "./cors.ts";

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface AuthContext {
  user: User;
  role: "student" | "admin";
  studentId: string | null;
}

export async function requireAuth(req: Request, requiredRole: "student" | "admin"): Promise<{ ctx: AuthContext; client: SupabaseClient } | Response> {
  const supabase = adminClient();

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return errorResponse("Unauthorized", 401, "NO_TOKEN");

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return errorResponse("Unauthorized", 401, "INVALID_TOKEN");

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role, student_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!roleData || roleData.role !== requiredRole) {
    return errorResponse(`${requiredRole} access required`, 403, "FORBIDDEN");
  }

  return {
    ctx: {
      user: userData.user,
      role: roleData.role,
      studentId: roleData.student_id,
    },
    client: supabase,
  };
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function logAudit(
  supabase: SupabaseClient,
  actor: string,
  actorRole: string,
  action: string,
  detail: Record<string, unknown> | null,
  req?: Request,
): Promise<void> {
  const ip = req
    ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
    : "unknown";
  await supabase.from("audit_logs").insert({
    actor,
    actor_role: actorRole,
    action,
    detail,
    ip_address: ip,
  });
}
