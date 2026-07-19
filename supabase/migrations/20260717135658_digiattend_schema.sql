-- ===== students =====
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  department text NOT NULL,
  year text NOT NULL,
  section text NOT NULL,
  phone text,
  profile_picture text,
  password_hash text NOT NULL,
  auth_user_id uuid,
  device_fingerprint text,
  device_info jsonb,
  browser_info jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===== user_roles =====
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student','admin')),
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ===== qr_codes =====
CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  location text,
  enabled boolean NOT NULL DEFAULT true,
  is_dynamic boolean NOT NULL DEFAULT false,
  dynamic_token text,
  created_at timestamptz DEFAULT now()
);

-- ===== geofence_locations =====
CREATE TABLE IF NOT EXISTS geofence_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 200,
  is_primary boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ===== attendance =====
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  register_number text NOT NULL,
  student_name text NOT NULL,
  department text NOT NULL,
  year text NOT NULL,
  section text NOT NULL,
  date date NOT NULL,
  time time NOT NULL,
  latitude double precision,
  longitude double precision,
  gps_accuracy double precision,
  device_info jsonb,
  browser_info jsonb,
  ip_address text,
  attendance_status text NOT NULL DEFAULT 'present' CHECK (attendance_status IN ('present','absent','late','manual')),
  qr_code_id uuid REFERENCES qr_codes(id) ON DELETE SET NULL,
  device_fingerprint text,
  is_duplicate boolean NOT NULL DEFAULT false,
  fraud_flags jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_dept ON attendance(department);

-- ===== notifications =====
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('college','department','year','section','individual')),
  department text,
  year text,
  section text,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- ===== audit_logs =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  detail jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- ===== settings =====
CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  college_name text NOT NULL DEFAULT 'MNM Jain Engineering College',
  attendance_start time NOT NULL DEFAULT '08:30',
  attendance_end time NOT NULL DEFAULT '09:30',
  grace_minutes integer NOT NULL DEFAULT 15,
  min_attendance_pct numeric NOT NULL DEFAULT 75,
  geofence_radius integer NOT NULL DEFAULT 200,
  college_latitude double precision NOT NULL DEFAULT 12.9698,
  college_longitude double precision NOT NULL DEFAULT 80.2433,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- ===== RLS =====
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- user_roles: read own
DROP POLICY IF EXISTS "read_own_role" ON user_roles;
CREATE POLICY "read_own_role" ON user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- students: read own, update own
DROP POLICY IF EXISTS "read_own_student" ON students;
CREATE POLICY "read_own_student" ON students FOR SELECT
  TO authenticated USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_student" ON students;
CREATE POLICY "update_own_student" ON students FOR UPDATE
  TO authenticated USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- qr_codes: authenticated read
DROP POLICY IF EXISTS "read_qr_codes" ON qr_codes;
CREATE POLICY "read_qr_codes" ON qr_codes FOR SELECT
  TO authenticated USING (true);

-- geofence_locations: authenticated read enabled
DROP POLICY IF EXISTS "read_geofence" ON geofence_locations;
CREATE POLICY "read_geofence" ON geofence_locations FOR SELECT
  TO authenticated USING (enabled = true);

-- attendance: read own, insert own
DROP POLICY IF EXISTS "read_own_attendance" ON attendance;
CREATE POLICY "read_own_attendance" ON attendance FOR SELECT
  TO authenticated USING (
    student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_attendance" ON attendance;
CREATE POLICY "insert_own_attendance" ON attendance FOR INSERT
  TO authenticated WITH CHECK (
    student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid())
  );

-- notifications: read where audience matches the student
DROP POLICY IF EXISTS "read_notifications" ON notifications;
CREATE POLICY "read_notifications" ON notifications FOR SELECT
  TO authenticated USING (
    audience = 'college'
    OR (audience = 'individual' AND student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid()))
    OR (
      audience IN ('department','year','section')
      AND EXISTS (
        SELECT 1 FROM students s
        WHERE s.auth_user_id = auth.uid()
        AND (notifications.department IS NULL OR notifications.department = s.department)
        AND (notifications.year IS NULL OR notifications.year = s.year)
        AND (notifications.section IS NULL OR notifications.section = s.section)
      )
    )
  );

-- settings: authenticated read
DROP POLICY IF EXISTS "read_settings" ON settings;
CREATE POLICY "read_settings" ON settings FOR SELECT
  TO authenticated USING (true);

-- updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_updated_at ON students;
CREATE TRIGGER students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();