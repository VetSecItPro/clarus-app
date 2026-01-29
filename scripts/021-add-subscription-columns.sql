-- Add subscription columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS polar_customer_id text,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS subscription_id text,
ADD COLUMN IF NOT EXISTS subscription_ends_at timestamp with time zone;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_polar_customer_id ON public.users(polar_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status);

-- Grandfather all existing users (set them to 'grandfathered' status = free forever)
UPDATE public.users
SET subscription_status = 'grandfathered'
WHERE subscription_status IS NULL OR subscription_status = 'none';

-- Add RLS policy for users to read/update their own subscription info
DROP POLICY IF EXISTS "Users can update their own subscription info" ON public.users;
CREATE POLICY "Users can update their own subscription info"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
