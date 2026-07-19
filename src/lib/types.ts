export type Role = "student" | "admin";

export interface Student {
  id: string;
  register_number: string;
  full_name: string;
  email: string;
  department: string;
  year: string;
  section: string;
  phone: string | null;
  profile_picture: string | null;
  auth_user_id: string | null;
  device_fingerprint: string | null;
  device_info: any;
  browser_info: any;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  register_number: string;
  student_name: string;
  department: string;
  year: string;
  section: string;
  date: string;
  time: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  device_info: any;
  browser_info: any;
  ip_address: string | null;
  attendance_status: "present" | "absent" | "late" | "manual";
  qr_code_id: string | null;
  device_fingerprint: string | null;
  is_duplicate: boolean;
  fraud_flags: any;
  notes: string | null;
  created_at: string;
}

export interface QrCode {
  id: string;
  code: string;
  label: string;
  location: string | null;
  enabled: boolean;
  is_dynamic: boolean;
  dynamic_token: string | null;
  created_at: string;
}

export interface GeofenceLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_primary: boolean;
  enabled: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  audience: string;
  department: string | null;
  year: string | null;
  section: string | null;
  student_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actor_role: string;
  action: string;
  detail: any;
  ip_address: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  college_name: string;
  attendance_start: string;
  attendance_end: string;
  grace_minutes: number;
  min_attendance_pct: number;
  geofence_radius: number;
  gps_accuracy_limit: number;
  college_latitude: number;
  college_longitude: number;
  updated_at: string;
}
