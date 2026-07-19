import { requireAuth, logAudit } from "../_shared/auth.ts";
import { json, errorResponse, getClientIp } from "../_shared/cors.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

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

  const auth = await requireAuth(req, "student");
  if (auth instanceof Response) return auth;
  const { ctx, client: supabase } = auth;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "mark") return await markAttendance(supabase, ctx, body, req);
    if (action === "register_device") return await registerDevice(supabase, ctx, body);
    return errorResponse("Unknown action", 400, "UNKNOWN_ACTION");
  } catch (err) {
    console.error("[student-ops] error:", err);
    return errorResponse(err.message || "Internal server error", 500, "INTERNAL");
  }
}

async function markAttendance(supabase: SupabaseClient, ctx: AuthContext, body: MarkPayload, req: Request) {
  const studentId = ctx.studentId;
  if (!studentId) return errorResponse("Student profile not linked", 403, "NO_PROFILE");

  const { qr_code, latitude, longitude, gps_accuracy, device_info, browser_info, device_fingerprint } = body;

  // Validate required inputs
  if (!qr_code || typeof qr_code !== "string") return errorResponse("QR code is required", 400, "QR_REQUIRED");
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return errorResponse("Location is required", 400, "LOCATION_DENIED");
  }
  if (typeof gps_accuracy !== "number") return errorResponse("GPS accuracy is required", 400, "GPS_REQUIRED");

  const fraudFlags: Record<string, boolean> = {};

  // 1. QR validation (server-side only — students cannot read qr_codes table)
  const { data: qr } = await supabase.from("qr_codes").select("*").eq("code", qr_code).maybeSingle();
  if (!qr) return errorResponse("Invalid QR code", 400, "QR_INVALID");
  if (!qr.enabled) return errorResponse("This QR code is disabled", 400, "QR_DISABLED");

  // 2. Time window validation (server authoritative)
  const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  if (!settings) return errorResponse("Settings unavailable", 500, "SETTINGS");
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  const start = settings.attendance_start;
  const end = settings.attendance_end;
  const graceEnd = addMinutes(end, settings.grace_minutes);
  if (hhmm < start || hhmm > graceEnd) {
    return errorResponse(`Attendance window is ${start} to ${graceEnd}`, 400, "OUTSIDE_WINDOW");
  }

  // 3. GPS accuracy
  const accuracyLimit = settings.gps_accuracy_limit ?? 150;
  if (gps_accuracy > accuracyLimit) {
    return errorResponse(
      `Your location accuracy is currently low (±${Math.round(gps_accuracy)} meters). Please move closer to a window or open area and try again.`,
      400, "GPS_ACCURACY",
    );
  }

  // 4. Geofence validation (server-side)
  const { data: fences } = await supabase.from("geofence_locations").select("*").eq("enabled", true);
  let inside = false;
  let nearestDist = Infinity;
  for (const f of fences || []) {
    const dist = haversine(latitude, longitude, f.latitude, f.longitude);
    if (dist < nearestDist) { nearestDist = dist; }
    if (dist <= f.radius_meters) { inside = true; break; }
  }
  if (!inside) {
    return errorResponse("You are outside the college campus geofence", 400, "OUTSIDE_GEOFENCE");
  }

  // 5. Device fingerprint verification
  const { data: student } = await supabase.from("students").select("*").eq("id", studentId).maybeSingle();
  if (!student) return errorResponse("Student not found", 404, "NOT_FOUND");
  if (student.device_fingerprint && student.device_fingerprint !== device_fingerprint) {
    return errorResponse("Unregistered device. Use your registered device.", 400, "DEVICE_MISMATCH");
  }
  if (!student.device_fingerprint) {
    await supabase.from("students").update({
      device_fingerprint, device_info, browser_info,
    }).eq("id", studentId);
  }

  // 6. Duplicate attendance check (UNIQUE constraint also enforces)
  const today = now.toISOString().slice(0, 10);
  const { data: existing } = await supabase.from("attendance")
    .select("id").eq("student_id", studentId).eq("date", today).maybeSingle();
  if (existing) {
    return json({ message: "Attendance already marked for today.", code: "DUPLICATE", alreadyMarked: true }, 200);
  }

  // 7. Multiple-device detection
  const { data: dupDevice } = await supabase.from("attendance")
    .select("id").eq("date", today).eq("device_fingerprint", device_fingerprint)
    .neq("student_id", studentId).maybeSingle();
  if (dupDevice) fraudFlags.multiple_device = true;

  // 8. Fake GPS heuristic
  if (gps_accuracy < 5) fraudFlags.fake_gps_suspected = true;

  const ip = getClientIp(req);
  const serverTime = now.toTimeString().slice(0, 8);
  const status = hhmm > end ? "late" : "present";

  const { data: att, error } = await supabase.from("attendance").insert({
    student_id: studentId,
    register_number: student.register_number,
    student_name: student.full_name,
    department: student.department,
    year: student.year,
    section: student.section,
    date: today,
    time: serverTime,
    latitude, longitude, gps_accuracy,
    device_info, browser_info,
    ip_address: ip,
    attendance_status: status,
    qr_code_id: qr.id,
    device_fingerprint,
    fraud_flags: fraudFlags,
  }).select().maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return json({ message: "Attendance already marked for today.", code: "DUPLICATE", alreadyMarked: true }, 200);
    }
    return errorResponse(error.message, 400, "DB_ERROR");
  }

  await logAudit(supabase, student.register_number, "student", "mark_attendance", { date: today, status }, req);

  return json({ success: true, attendance: att, status });
}

async function registerDevice(supabase: SupabaseClient, ctx: AuthContext, body: DevicePayload) {
  const { device_fingerprint, device_info, browser_info } = body;
  if (!device_fingerprint) return errorResponse("device_fingerprint is required", 400, "VALIDATION");
  const { error } = await supabase.from("students").update({
    device_fingerprint, device_info, browser_info,
  }).eq("id", ctx.studentId);
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  return json({ success: true });
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
