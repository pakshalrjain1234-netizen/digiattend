-- Admin can read all students
DROP POLICY IF EXISTS "read_all_students_admin" ON students;
CREATE POLICY "read_all_students_admin" ON students FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can read all attendance records
DROP POLICY IF EXISTS "read_all_attendance_admin" ON attendance;
CREATE POLICY "read_all_attendance_admin" ON attendance FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can read all notifications
DROP POLICY IF EXISTS "read_all_notifications_admin" ON notifications;
CREATE POLICY "read_all_notifications_admin" ON notifications FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can read all geofence locations (including disabled)
DROP POLICY IF EXISTS "read_all_geofence_admin" ON geofence_locations;
CREATE POLICY "read_all_geofence_admin" ON geofence_locations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can read audit logs
DROP POLICY IF EXISTS "read_audit_logs_admin" ON audit_logs;
CREATE POLICY "read_audit_logs_admin" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );