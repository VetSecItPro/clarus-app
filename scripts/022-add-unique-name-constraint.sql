-- Add unique constraint on name column for users table
-- This ensures usernames are unique across the platform

-- First, update any null or empty names to ensure they have values
UPDATE public.users 
SET name = 'User_' || SUBSTRING(id::text FROM 1 FOR 8)
WHERE name IS NULL OR name = '';

-- Add unique constraint
ALTER TABLE public.users 
ADD CONSTRAINT users_name_unique UNIQUE (name);

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_name ON public.users (name);
