-- =============================================================================
-- CLARUS SCHEMA ISOLATION
-- =============================================================================
-- This script creates a separate 'clarus' schema to isolate Clarus tables
-- from other projects sharing this Supabase instance.
--
-- IMPORTANT: Run this BEFORE running 000-full-schema.sql
--
-- How it works:
-- 1. Creates the 'clarus' schema
-- 2. Sets search_path so 'clarus' is checked first
-- 3. All tables created afterwards will be in the 'clarus' schema
-- 4. Existing tables in 'public' schema are UNTOUCHED
-- =============================================================================

-- Create the clarus schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS clarus;

-- Grant usage on the schema to authenticated users
GRANT USAGE ON SCHEMA clarus TO authenticated;
GRANT USAGE ON SCHEMA clarus TO anon;
GRANT USAGE ON SCHEMA clarus TO service_role;

-- Set default privileges for future tables in clarus schema
ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT ALL ON TABLES TO service_role;

-- Set default privileges for sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT USAGE, SELECT ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT ALL ON SEQUENCES TO service_role;

-- Set default privileges for functions
ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT EXECUTE ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT EXECUTE ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA clarus
    GRANT EXECUTE ON FUNCTIONS TO service_role;

-- =============================================================================
-- CRITICAL: Set search_path for all roles
-- =============================================================================
-- This makes 'clarus' the first schema searched, so unqualified table names
-- like 'users' will resolve to 'clarus.users' instead of 'public.users'

-- For the postgres superuser (used by migrations)
ALTER ROLE postgres SET search_path TO clarus, public, extensions;

-- For authenticated users (logged-in app users)
ALTER ROLE authenticated SET search_path TO clarus, public, extensions;

-- For anonymous users (not logged in)
ALTER ROLE anon SET search_path TO clarus, public, extensions;

-- For service_role (admin operations)
ALTER ROLE service_role SET search_path TO clarus, public, extensions;

-- For authenticator role (Supabase internal)
ALTER ROLE authenticator SET search_path TO clarus, public, extensions;

-- Set search_path for current session so subsequent commands use it
SET search_path TO clarus, public, extensions;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- After running this script, verify with:
-- SHOW search_path;
-- Should return: clarus, public, extensions

-- To see all schemas:
-- SELECT schema_name FROM information_schema.schemata;

-- =============================================================================
-- NOTES
-- =============================================================================
-- 1. Tables in 'public' schema are COMPLETELY IGNORED
-- 2. New tables created by 000-full-schema.sql will go into 'clarus' schema
-- 3. App code doesn't need any changes - just references 'users', 'content', etc.
-- 4. DO NOT create foreign keys to tables outside the 'clarus' schema
-- 5. DO NOT query tables in the 'public' schema from Clarus code
