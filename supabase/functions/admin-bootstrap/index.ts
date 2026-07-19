import { adminClient, logAudit } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/cors.ts";

if (import.meta.main) {
  Deno.serve(handleRequest);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405, "METHOD");

  try {
    const supabase = adminClient();
    const { email, password } = await req.json();

    if (!email || !password) return errorResponse("Email and password are required", 400, "VALIDATION");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse("Valid email is required", 400, "VALIDATION");
    if (String(password).length < 6) return errorResponse("Password must be at least 6 characters", 400, "VALIDATION");

    // Security: only allow bootstrap if no admin exists yet
    const { data: existingAdmins, error: checkErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    if (checkErr) return errorResponse("Database check failed", 500, "DB_ERROR");
    if (existingAdmins && existingAdmins.length > 0) {
      return errorResponse("An admin account already exists. Contact the administrator.", 403, "ADMIN_EXISTS");
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });
    if (authErr) return errorResponse(authErr.message, 400, "AUTH_CREATE");

    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: authUser.user.id,
      role: "admin",
    });
    if (roleErr) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return errorResponse(roleErr.message, 400, "ROLE_CREATE");
    }

    await logAudit(supabase, normalizedEmail, "admin", "admin_bootstrap", { email: normalizedEmail }, req);

    return json({ success: true, message: "Admin account created. You can now sign in." });
  } catch (err) {
    console.error("[admin-bootstrap] error:", err);
    return errorResponse(err.message || "Internal server error", 500, "INTERNAL");
  }
}
