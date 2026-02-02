-- Contact form submissions for logging and retry
-- Applied via Supabase MCP on 2026-02-01
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, failed
  resend_message_id TEXT,
  error_message TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Index for retry queries (find failed/pending submissions)
CREATE INDEX idx_contact_submissions_status ON contact_submissions(status) WHERE status != 'sent';

-- RLS: no public access, only service role
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service_role can access (admin client)
