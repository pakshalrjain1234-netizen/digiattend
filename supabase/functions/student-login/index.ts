import { adminClient, sha256, logAudit } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/cors.ts";

if (import.meta.main) {
  Deno.serve(handleRequest);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Simple in-memory rate limiting (per Deno isolate). Limits burst login attempts.
const loginAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000;

async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405, "METHOD");

  try {
    const supabase = adminClient();
    const body = await req.json();
    const { register_number, password } = body;

    if (!register_number || !password) {
      return errorResponse("Register number and password are required", 400, "VALIDATION");
    }

    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const record = loginAttempts.get(ip);
    if (record) {
      if (now - record.firstAt < WINDOW_MS) {
        if (record.count >= MAX_ATTEMPTS) {
          return errorResponse("Too many login attempts. Please try again later.", 429, "RATE_LIMIT");
        }
        record.count++;
      } else {
        loginAttempts.set(ip, { count: 1, firstAt: now });
      }
    } else {
      loginAttempts.set(ip, { count: 1, firstAt: now });
    }

    const { data: student, error } = await supabase
      .from("students")
      .select("email, password_hash, register_number, status")
      .eq("register_number", String(register_number).trim())
      .maybeSingle();

    if (error || !student) {
      return errorResponse("Invalid register number or password", 401, "INVALID_CREDENTIALS");
    }
    if (student.status !== "active") {
      return errorResponse("Your account is inactive. Contact admin.", 403, "INACTIVE");
    }

    const passwordHash = await sha256(String(password) + student.register_number);
    if (passwordHash !== student.password_hash) {
      return errorResponse("Invalid register number or password", 401, "INVALID_CREDENTIALS");
    }

    await logAudit(supabase, student.register_number, "student", "student_login", { method: "register_number" }, req);

    // Clear rate limit on success
    loginAttempts.delete(ip);

    return json({ email: student.email });
  } catch (err) {
    console.error("[student-login] error:", err);
    return errorResponse(err.message || "Internal server error", 500, "INTERNAL");
  }
}
