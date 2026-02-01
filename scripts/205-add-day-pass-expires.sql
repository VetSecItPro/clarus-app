-- Add day_pass_expires_at column to track when a day pass expires
-- Day passes are one-time $10 purchases that grant 24-hour elevated access
ALTER TABLE clarus.users ADD COLUMN IF NOT EXISTS day_pass_expires_at TIMESTAMPTZ DEFAULT NULL;
