-- Add GPS accuracy limit column (default 150m)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gps_accuracy_limit integer NOT NULL DEFAULT 150;

-- Update default geofence radius to 500m
ALTER TABLE settings ALTER COLUMN geofence_radius SET DEFAULT 500;

-- Update existing row to use new defaults if not already set
UPDATE settings SET gps_accuracy_limit = 150 WHERE gps_accuracy_limit IS NULL;
UPDATE settings SET geofence_radius = 500 WHERE geofence_radius = 200;