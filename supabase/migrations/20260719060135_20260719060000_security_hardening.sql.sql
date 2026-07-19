/*
# Production Security Hardening

## Summary
Resolves all 4 Supabase Security Advisor warnings and locks down
database permissions for production deployment of DigiAttend.

## Issues Fixed

### 1. Function Search Path Mutable (set_updated_at)
- `public.set_updated_at()` trigger function had no explicit `search_path`.
- PostgreSQL functions without an explicit `search_path` are vulnerable to
  search-path hijacking (an attacker who can create objects in a schema that
  appears earlier in the runtime search_path can shadow built-ins).
- Fix: re-create the function with `SET search_path TO pg_catalog, public`
  so resolution is deterministic and immutable.

### 2. SECURITY DEFINER Function (rls_auto_enable)
- `public.rls_auto_enable()` is an event trigger function declared
  SECURITY DEFINER and executable by anon + authenticated.
- It was only needed during initial schema setup to auto-enable RLS on
  new tables. All tables already have RLS enabled, so the function and
  its event trigger (`ensure_rls`) are no longer needed in production.
- Fix: drop the `ensure_rls` event trigger and the function. This removes
  the SECURITY DEFINER surface and the public EXECUTE grant.

### 3. RLS Exposes All QR Codes (qr_codes)
- The `read_qr_codes` policy used `USING (true)` scoped to
  `authenticated`, meaning ANY signed-in student could SELECT every QR
  code row (enabled, disabled, expired) directly via the PostgREST API.
- QR validation is performed server-side inside the `student-ops` edge
  function (service role), so students never need direct table access
  to qr_codes.
- Fix: drop the public `read_qr_codes` policy. Add `read_qr_codes_admin`
  scoped to admins only. Students can no longer read the table directly.

### 4. Overbroad Grants to anon / authenticated
- Supabase grants `anon` and `authenticated` full DML (INSERT, UPDATE,
  DELETE, TRUNCATE) on every table by default. RLS blocks the rows, but
  least-privilege requires revoking direct DML on tables that are only
  ever written through service-role edge functions.
- The app writes attendance, audit_logs, qr_codes, geofence_locations,
  notifications, settings, user_roles, and students exclusively through
  edge functions (service role). The only client-side write remaining is
  a student updating their OWN profile row (phone, profile_picture),
  which is protected by the `update_own_student` RLS policy.
- Fix:
  - Revoke ALL privileges from `anon` on every table (anon never needs
    direct table access — public edge functions use the service role).
  - Revoke INSERT/UPDATE/DELETE/TRUNCATE from `authenticated` on
    attendance, audit_logs, qr_codes, geofence_locations, notifications,
    settings, user_roles (these are service-role only).
  - Keep `authenticated` SELECT where the frontend reads directly
    (students, attendance, notifications, user_roles, geofence_locations,
    settings, qr_codes for admins).
  - Keep `authenticated` UPDATE on students only (for self-profile
    update via RLS).

## Tables Affected
- students, attendance, qr_codes, geofence_locations, notifications,
  settings, user_roles, audit_logs

## Security Changes
- Function `set_updated_at` now has immutable search_path.
- Function `rls_auto_enable` and its `ensure_rls` event trigger dropped.
- `qr_codes` no longer readable by students directly.
- `anon` loses ALL table privileges.
- `authenticated` loses write privileges on service-role-only tables.

## Notes
- No data is modified or deleted.
- Existing student self-update (phone, profile_picture) still works via
  the retained `update_own_student` RLS policy + authenticated UPDATE
  grant on the students table.
- All admin/student mutations continue to flow through edge functions
  using the service role key, which bypasses RLS.
*/

-- ---------------------------------------------------------------------------
-- 1. Fix set_updated_at: immutable search_path
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_set_updated_t ON students;
DROP TRIGGER IF EXISTS trg_set_updated_t ON attendance;
DROP TRIGGER IF EXISTS trg_set_updated_t ON qr_codes;
DROP TRIGGER IF EXISTS trg_set_updated_t ON geofence_locations;
DROP TRIGGER IF EXISTS trg_set_updated_t ON notifications;
DROP TRIGGER IF EXISTS trg_set_updated_t ON settings;
DROP TRIGGER IF EXISTS trg_set_updated_t ON user_roles;
DROP TRIGGER IF EXISTS trg_set_updated_t ON audit_logs;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Re-attach triggers for tables that have an updated_at column.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['students','attendance','qr_codes','geofence_locations','notifications','settings','user_roles','audit_logs'])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_set_updated_t BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Remove rls_auto_enable event trigger + function (setup-only helper)
-- ---------------------------------------------------------------------------
DROP EVENT TRIGGER IF EXISTS ensure_rls;
DROP FUNCTION IF EXISTS public.rls_auto_enable();

-- ---------------------------------------------------------------------------
-- 3. Tighten qr_codes RLS: admin-only read, no student direct access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "read_qr_codes" ON qr_codes;
DROP POLICY IF EXISTS "read_qr_codes_admin" ON qr_codes;

CREATE POLICY "read_qr_codes_admin" ON qr_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Revoke overbroad privileges
-- ---------------------------------------------------------------------------

-- anon: revoke EVERYTHING on all public tables. anon never needs direct
-- table access — public edge functions (student-login, admin-bootstrap)
-- run with the service role key.
REVOKE ALL ON TABLE public.students FROM anon;
REVOKE ALL ON TABLE public.attendance FROM anon;
REVOKE ALL ON TABLE public.qr_codes FROM anon;
REVOKE ALL ON TABLE public.geofence_locations FROM anon;
REVOKE ALL ON TABLE public.notifications FROM anon;
REVOKE ALL ON TABLE public.settings FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM anon;

-- authenticated: revoke write on service-role-only tables. These are
-- only ever written by edge functions using the service role key.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.attendance FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.qr_codes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.geofence_locations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.notifications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.settings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.user_roles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM authenticated;

-- students: authenticated keeps SELECT (own row) + UPDATE (own profile).
-- Revoke INSERT and DELETE (only admin edge functions create/delete students).
REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.students FROM authenticated;

-- Ensure service_role retains full access (it bypasses RLS, but keep grants explicit).
GRANT ALL ON TABLE public.students TO service_role;
GRANT ALL ON TABLE public.attendance TO service_role;
GRANT ALL ON TABLE public.qr_codes TO service_role;
GRANT ALL ON TABLE public.geofence_locations TO service_role;
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT ALL ON TABLE public.settings TO service_role;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT ALL ON TABLE public.audit_logs TO service_role;
