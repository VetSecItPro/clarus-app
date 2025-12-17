-- This script adds 'x_post' to the content_type enum.
-- It's designed to be safe to run multiple times, so it won't cause an error if the type already exists.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'content_type'::regtype AND enumlabel = 'x_post') THEN
        ALTER TYPE content_type ADD VALUE 'x_post';
    END IF;
END$$;
