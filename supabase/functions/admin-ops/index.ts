import { requireAuth, logAudit, sha256, AuthContext } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/cors.ts";
import { validateStudentRow, ImportResult, ImportFailure } from "./import-validation.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

if (import.meta.main) {
  Deno.serve(handleRequest);
}

async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const auth = await requireAuth(req, "admin");
  if (auth instanceof Response) return auth;
  const { ctx, client: supabase } = auth;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create_student": return await createStudent(supabase, body, ctx, req);
      case "update_student": return await updateStudent(supabase, body, ctx, req);
      case "delete_student": return await deleteStudent(supabase, body, ctx, req);
      case "reset_password": return await resetPassword(supabase, body, ctx, req);
      case "toggle_status": return await toggleStatus(supabase, body, ctx, req);
      case "upsert_qr": return await upsertQr(supabase, body, ctx, req);
      case "delete_qr": return await deleteQr(supabase, body, ctx, req);
      case "upsert_geofence": return await upsertGeofence(supabase, body, ctx, req);
      case "delete_geofence": return await deleteGeofence(supabase, body, ctx, req);
      case "send_notification": return await sendNotification(supabase, body, ctx, req);
      case "update_settings": return await updateSettings(supabase, body, ctx, req);
      case "manual_attendance": return await manualAttendance(supabase, body, ctx, req);
      case "edit_attendance": return await editAttendance(supabase, body, ctx, req);
      case "delete_attendance": return await deleteAttendance(supabase, body, ctx, req);
      case "import_students": return await importStudents(supabase, body, ctx, req);
      case "import_history": return await importHistory(supabase);
      default: return errorResponse("Unknown action", 400, "UNKNOWN_ACTION");
    }
  } catch (err) {
    console.error("[admin-ops] error:", err);
    return errorResponse(err.message || "Internal server error", 500, "INTERNAL");
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ===== Student CRUD =====

async function createStudent(supabase: SupabaseClient, body: StudentPayload, ctx: AuthContext, req: Request) {
  const { email, password, register_number, full_name, department, year, section, phone } = body;
  const vErr = validateStudentFields({ email, password, register_number, full_name, department, year, section });
  if (vErr) return errorResponse(vErr, 400, "VALIDATION");

  const normalizedEmail = String(email).trim().toLowerCase();

  // Check duplicates up front
  const { data: dupReg } = await supabase.from("students").select("id").eq("register_number", register_number).maybeSingle();
  if (dupReg) return errorResponse("Register number already exists", 409, "DUP_REGISTER");
  const { data: dupEmail } = await supabase.from("students").select("id").eq("email", normalizedEmail).maybeSingle();
  if (dupEmail) return errorResponse("Email already exists", 409, "DUP_EMAIL");

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });
  if (authErr) return errorResponse(authErr.message, 400, "AUTH_CREATE");

  const passwordHash = await sha256(password + register_number);
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .insert({
      register_number, full_name, email: normalizedEmail, department, year, section, phone,
      password_hash: passwordHash, auth_user_id: authUser.user.id, status: "active",
    })
    .select().maybeSingle();

  if (studentErr || !student) {
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return errorResponse(studentErr?.message || "Failed to create student", 400, "STUDENT_CREATE");
  }

  const { error: roleErr } = await supabase.from("user_roles").insert({
    user_id: authUser.user.id, role: "student", student_id: student.id,
  });
  if (roleErr) {
    await supabase.from("students").delete().eq("id", student.id);
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return errorResponse(roleErr.message, 400, "ROLE_CREATE");
  }

  await logAudit(supabase, ctx.user.email || "admin", "admin", "create_student", { register_number, full_name }, req);
  return json({ student });
}

async function updateStudent(supabase: SupabaseClient, body: StudentUpdatePayload, ctx: AuthContext, req: Request) {
  const { id, ...updates } = body;
  if (!id) return errorResponse("Missing id", 400, "VALIDATION");
  const allowed: Record<string, unknown> = {};
  for (const k of ["full_name", "email", "department", "year", "section", "phone", "profile_picture", "status"]) {
    if (updates[k] !== undefined) allowed[k] = updates[k];
  }
  if (allowed.email) allowed.email = String(allowed.email).trim().toLowerCase();

  if (allowed.email) {
    const { data: student } = await supabase.from("students").select("auth_user_id, email").eq("id", id).maybeSingle();
    if (student?.auth_user_id && student.email !== allowed.email) {
      const { error: authErr } = await supabase.auth.admin.updateUserById(student.auth_user_id, {
        email: allowed.email, email_confirm: true,
      });
      if (authErr) return errorResponse(`Failed to update auth email: ${authErr.message}`, 400, "AUTH_UPDATE");
    }
  }

  const { data, error } = await supabase.from("students").update(allowed).eq("id", id).select().maybeSingle();
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  await logAudit(supabase, ctx.user.email || "admin", "admin", "update_student", { id }, req);
  return json({ student: data });
}

async function deleteStudent(supabase: SupabaseClient, body: { id: string }, ctx: AuthContext, req: Request) {
  const { id } = body;
  if (!id) return errorResponse("Missing id", 400, "VALIDATION");
  const { data: student } = await supabase.from("students").select("auth_user_id, register_number").eq("id", id).maybeSingle();
  if (!student) return errorResponse("Student not found", 404, "NOT_FOUND");
  if (student.auth_user_id) {
    await supabase.auth.admin.deleteUser(student.auth_user_id);
  }
  await supabase.from("students").delete().eq("id", id);
  await logAudit(supabase, ctx.user.email || "admin", "admin", "delete_student", { register_number: student.register_number }, req);
  return json({ success: true });
}

async function resetPassword(supabase: SupabaseClient, body: { id: string; password: string }, ctx: AuthContext, req: Request) {
  const { id, password } = body;
  if (!id || !password) return errorResponse("Missing fields", 400, "VALIDATION");
  if (String(password).length < 6) return errorResponse("Password must be at least 6 characters", 400, "VALIDATION");
  const { data: student } = await supabase.from("students").select("auth_user_id, register_number").eq("id", id).maybeSingle();
  if (!student) return errorResponse("Student not found", 404, "NOT_FOUND");
  if (student.auth_user_id) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(student.auth_user_id, { password });
    if (authErr) return errorResponse(authErr.message, 400, "AUTH_UPDATE");
  }
  const passwordHash = await sha256(password + student.register_number);
  await supabase.from("students").update({ password_hash: passwordHash }).eq("id", id);
  await logAudit(supabase, ctx.user.email || "admin", "admin", "reset_password", { id }, req);
  return json({ success: true });
}

async function toggleStatus(supabase: SupabaseClient, body: { id: string; status: string }, ctx: AuthContext, req: Request) {
  const { id, status } = body;
  if (!id || !["active", "inactive"].includes(status)) return errorResponse("Invalid status", 400, "VALIDATION");
  const { data, error } = await supabase.from("students").update({ status }).eq("id", id).select().maybeSingle();
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  await logAudit(supabase, ctx.user.email || "admin", "admin", "toggle_status", { id, status }, req);
  return json({ student: data });
}

// ===== QR =====

async function upsertQr(supabase: SupabaseClient, body: QrPayload, ctx: AuthContext, req: Request) {
  const { id, code, label, location, enabled } = body;
  if (!label || !code) return errorResponse("Label and code are required", 400, "VALIDATION");
  const payload = { code, label, location: location || null, enabled: enabled !== false };
  let data, error;
  if (id) {
    ({ data, error } = await supabase.from("qr_codes").update(payload).eq("id", id).select().maybeSingle());
  } else {
    ({ data, error } = await supabase.from("qr_codes").insert(payload).select().maybeSingle());
  }
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  await logAudit(supabase, ctx.user.email || "admin", "admin", "upsert_qr", { id: id || null, label }, req);
  return json({ qr: data });
}

async function deleteQr(supabase: SupabaseClient, body: { id: string }, ctx: AuthContext, req: Request) {
  const { id } = body;
  if (!id) return errorResponse("Missing id", 400, "VALIDATION");
  await supabase.from("qr_codes").delete().eq("id", id);
  await logAudit(supabase, ctx.user.email || "admin", "admin", "delete_qr", { id }, req);
  return json({ success: true });
}

// ===== Geofence =====

async function upsertGeofence(supabase: SupabaseClient, body: GeofencePayload, ctx: AuthContext, req: Request) {
  const { id, name, latitude, longitude, radius_meters, is_primary, enabled } = body;
  if (!name || typeof latitude !== "number" || typeof longitude !== "number") {
    return errorResponse("Name, latitude, longitude required", 400, "VALIDATION");
  }
  const payload = {
    name, latitude, longitude,
    radius_meters: Math.max(10, Number(radius_meters) || 200),
    is_primary: !!is_primary,
    enabled: enabled !== false,
  };
  if (is_primary) {
    await supabase.from("geofence_locations").update({ is_primary: false }).eq("is_primary", true);
  }
  let data, error;
  if (id) {
    ({ data, error } = await supabase.from("geofence_locations").update(payload).eq("id", id).select().maybeSingle());
  } else {
    ({ data, error } = await supabase.from("geofence_locations").insert(payload).select().maybeSingle());
  }
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  await logAudit(supabase, ctx.user.email || "admin", "admin", "upsert_geofence", { id: id || null, name }, req);
  return json({ geofence: data });
}

async function deleteGeofence(supabase: SupabaseClient, body: { id: string }, ctx: AuthContext, req: Request) {
  const { id } = body;
  if (!id) return errorResponse("Missing id", 400, "VALIDATION");
  await supabase.from("geofence_locations").delete().eq("id", id);
  await logAudit(supabase, ctx.user.email || "admin", "admin", "delete_geofence", { id }, req);
  return json({ success: true });
}

// ===== Notifications =====

async function sendNotification(supabase: SupabaseClient, body: NotificationPayload, ctx: AuthContext, req: Request) {
  const { title, body: text, audience, department, year, section, student_id } = body;
  if (!title || !text || !audience) return errorResponse("title, body, audience required", 400, "VALIDATION");
  if (!["college", "department", "year", "section", "individual"].includes(audience)) {
    return errorResponse("Invalid audience", 400, "VALIDATION");
  }
  const { data, error } = await supabase.from("notifications").insert({
    title, body: text, audience, department: department || null, year: year || null,
    section: section || null, student_id: student_id || null, created_by: ctx.user.email,
  }).select().maybeSingle();
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  await logAudit(supabase, ctx.user.email || "admin", "admin", "send_notification", { audience, title }, req);
  return json({ notification: data });
}

// ===== Settings =====

async function updateSettings(supabase: SupabaseClient, body: SettingsPayload, ctx: AuthContext, req: Request) {
  const allowed: Record<string, unknown> = {};
  for (const k of ["college_name", "attendance_start", "attendance_end", "grace_minutes", "min_attendance_pct", "geofence_radius", "gps_accuracy_limit", "college_latitude", "college_longitude"] as const) {
    if (body[k] !== undefined) allowed[k] = body[k];
  }
  const { data, error } = await supabase.from("settings").update(allowed).eq("id", 1).select().maybeSingle();
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  await logAudit(supabase, ctx.user.email || "admin", "admin", "update_settings", Object.keys(allowed), req);
  return json({ settings: data });
}

// ===== Attendance admin ops =====

async function manualAttendance(supabase: SupabaseClient, body: ManualAttendancePayload, ctx: AuthContext, req: Request) {
  const { student_id, date, status, notes } = body;
  if (!student_id || !date) return errorResponse("student_id and date required", 400, "VALIDATION");
  if (!["present", "absent", "late", "manual"].includes(status)) return errorResponse("Invalid status", 400, "VALIDATION");
  const { data: student } = await supabase.from("students").select("*").eq("id", student_id).maybeSingle();
  if (!student) return errorResponse("Student not found", 404, "NOT_FOUND");
  const { data, error } = await supabase.from("attendance").upsert({
    student_id, register_number: student.register_number, student_name: student.full_name,
    department: student.department, year: student.year, section: student.section,
    date, time: "00:00", attendance_status: status || "manual", notes: notes || null,
  }, { onConflict: "student_id,date" }).select().maybeSingle();
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  await logAudit(supabase, ctx.user.email || "admin", "admin", "manual_attendance", { student_id, date, status }, req);
  return json({ attendance: data });
}

async function editAttendance(supabase: SupabaseClient, body: EditAttendancePayload, ctx: AuthContext, req: Request) {
  const { id, ...updates } = body;
  if (!id) return errorResponse("Missing id", 400, "VALIDATION");
  const allowed: Record<string, unknown> = {};
  for (const k of ["attendance_status", "notes", "time"]) {
    if (updates[k] !== undefined) allowed[k] = updates[k];
  }
  const { data, error } = await supabase.from("attendance").update(allowed).eq("id", id).select().maybeSingle();
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  await logAudit(supabase, ctx.user.email || "admin", "admin", "edit_attendance", { id }, req);
  return json({ attendance: data });
}

async function deleteAttendance(supabase: SupabaseClient, body: { id: string }, ctx: AuthContext, req: Request) {
  const { id } = body;
  if (!id) return errorResponse("Missing id", 400, "VALIDATION");
  await supabase.from("attendance").delete().eq("id", id);
  await logAudit(supabase, ctx.user.email || "admin", "admin", "delete_attendance", { id }, req);
  return json({ success: true });
}

// ===== Import =====

async function importStudents(supabase: SupabaseClient, body: { students: Record<string, unknown>[] }, ctx: AuthContext, req: Request) {
  const { students } = body;
  if (!Array.isArray(students)) return errorResponse("Expected students array", 400, "VALIDATION");
  if (students.length === 0) return errorResponse("No students to import", 400, "VALIDATION");
  if (students.length > 500) return errorResponse("Maximum 500 students per import", 400, "LIMIT");

  const result: ImportResult = {
    total: students.length,
    imported: 0,
    failed: 0,
    duplicates: 0,
    validation_errors: 0,
    auth_errors: 0,
    failures: [] as ImportFailure[],
  };

  // Pre-fetch existing registers and emails for duplicate detection
  const registersInFile = students.map((s) => String(s.register_number || "")).filter(Boolean);
  const emailsInFile = students.map((s) => String(s.email || "")).filter(Boolean);
  const [{ data: existingByReg }, { data: existingByEmail }] = await Promise.all([
    supabase.from("students").select("register_number").in("register_number", registersInFile),
    supabase.from("students").select("email").in("email", emailsInFile),
  ]);
  const existingRegs = new Set((existingByReg || []).map((r) => r.register_number));
  const existingEmails = new Set((existingByEmail || []).map((r) => r.email.toLowerCase()));

  // Track within-file duplicates
  const seenRegs = new Set<string>();
  const seenEmails = new Set<string>();

  for (let i = 0; i < students.length; i++) {
    const raw = students[i] as Record<string, unknown>;
    const row = validateStudentRow(raw);
    if (row.error) {
      result.validation_errors++;
      result.failed++;
      result.failures.push({ row: i + 1, register_number: String(raw?.register_number || ""), full_name: String(raw?.full_name || ""), email: String(raw?.email || ""), reason: row.error, category: "validation" });
      continue;
    }

    const reg = row.register_number;
    const email = row.email.toLowerCase();

    // Duplicate check: DB or within-file
    if (existingRegs.has(reg) || seenRegs.has(reg)) {
      result.duplicates++;
      result.failed++;
      result.failures.push({ row: i + 1, register_number: reg, full_name: row.full_name, email: row.email, reason: "Register number already exists", category: "duplicate" });
      continue;
    }
    if (existingEmails.has(email) || seenEmails.has(email)) {
      result.duplicates++;
      result.failed++;
      result.failures.push({ row: i + 1, register_number: reg, full_name: row.full_name, email: row.email, reason: "Email already exists", category: "duplicate" });
      continue;
    }

    seenRegs.add(reg);
    seenEmails.add(email);

    // 1. Create auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: row.email, password: row.password, email_confirm: true,
    });
    if (authErr) {
      result.auth_errors++;
      result.failed++;
      result.failures.push({ row: i + 1, register_number: reg, full_name: row.full_name, email: row.email, reason: authErr.message, category: "auth" });
      continue;
    }

    // 2. Insert student row
    const passwordHash = await sha256(row.password + reg);
    const { data: student, error: studentErr } = await supabase
      .from("students")
      .insert({
        register_number: reg, full_name: row.full_name, email: row.email,
        department: row.department, year: row.year, section: row.section, phone: row.phone || null,
        password_hash: passwordHash, auth_user_id: authUser.user.id, status: "active",
      })
      .select().maybeSingle();

    if (studentErr || !student) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      result.failed++;
      result.failures.push({ row: i + 1, register_number: reg, full_name: row.full_name, email: row.email, reason: studentErr?.message || "DB insert failed", category: "db" });
      continue;
    }

    // 3. Assign role
    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: authUser.user.id, role: "student", student_id: student.id,
    });
    if (roleErr) {
      // Rollback: delete student + auth user
      await supabase.from("students").delete().eq("id", student.id);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      result.failed++;
      result.failures.push({ row: i + 1, register_number: reg, full_name: row.full_name, email: row.email, reason: roleErr.message, category: "role" });
      continue;
    }

    result.imported++;
  }

  await logAudit(supabase, ctx.user.email || "admin", "admin", "import_students", {
    total: result.total, imported: result.imported, failed: result.failed, duplicates: result.duplicates,
  }, req);

  return json(result);
}

async function importHistory(supabase: SupabaseClient): Promise<Response> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("actor, action, detail, created_at")
    .eq("action", "import_students")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return errorResponse(error.message, 400, "DB_ERROR");
  return json({ history: data || [] });
}

// ===== Validation helpers =====

interface StudentPayload { email: string; password: string; register_number: string; full_name: string; department: string; year: string; section: string; phone?: string }
interface StudentUpdatePayload { id: string; [key: string]: unknown }
interface QrPayload { id?: string; code: string; label: string; location?: string; enabled?: boolean }
interface GeofencePayload { id?: string; name: string; latitude: number; longitude: number; radius_meters: number; is_primary: boolean; enabled?: boolean }
interface NotificationPayload { title: string; body: string; audience: string; department?: string; year?: string; section?: string; student_id?: string }
interface SettingsPayload { [key: string]: unknown }
interface ManualAttendancePayload { student_id: string; date: string; status: string; notes?: string }
interface EditAttendancePayload { id: string; [key: string]: unknown }

function validateStudentFields(s: { email: string; password: string; register_number: string; full_name: string; department: string; year: string; section: string }): string | null {
  if (!s.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return "Valid email is required";
  if (!s.password || String(s.password).length < 6) return "Password must be at least 6 characters";
  if (!s.register_number) return "Register number is required";
  if (!s.full_name) return "Full name is required";
  if (!s.department) return "Department is required";
  if (!s.year) return "Year is required";
  if (!s.section) return "Room/Section is required";
  return null;
}
