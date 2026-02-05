-- Migration: 215 - Protect sensitive columns on clarus.users from user modification
-- SECURITY: FIX-DB-006 — Prevent privilege escalation via direct UPDATE
-- Users could previously set is_admin=true, tier='pro', subscription_status='active' etc.

-- 1. Create trigger function that resets sensitive columns for non-service-role callers
CREATE OR REPLACE FUNCTION clarus.protect_user_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = clarus
AS $$
DECLARE
  _role text;
BEGIN
  -- Allow service_role full access (webhooks, crons, admin operations)
  _role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_setting('role', true)
  );

  IF _role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For all other callers, protect sensitive columns by resetting to OLD values
  NEW.is_admin := OLD.is_admin;
  NEW.tier := OLD.tier;
  NEW.subscription_status := OLD.subscription_status;
  NEW.subscription_id := OLD.subscription_id;
  NEW.subscription_ends_at := OLD.subscription_ends_at;
  NEW.polar_customer_id := OLD.polar_customer_id;
  NEW.day_pass_expires_at := OLD.day_pass_expires_at;
  NEW.level := OLD.level;
  NEW.xp := OLD.xp;
  NEW.reputation := OLD.reputation;

  RETURN NEW;
END;
$$;

-- 2. Attach trigger BEFORE UPDATE
CREATE TRIGGER protect_user_sensitive_fields
  BEFORE UPDATE ON clarus.users
  FOR EACH ROW
  EXECUTE FUNCTION clarus.protect_user_fields();

-- 3. Add WITH CHECK to UPDATE policy for defense-in-depth
DROP POLICY IF EXISTS "Users can update their own profile" ON clarus.users;
CREATE POLICY "Users can update their own profile"
  ON clarus.users FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
