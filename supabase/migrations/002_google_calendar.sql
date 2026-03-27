-- Google OAuth token storage
CREATE TABLE IF NOT EXISTS google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_label TEXT NOT NULL DEFAULT 'nick',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scopes TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/calendar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tokens_user ON google_tokens(user_label);

-- Add google_event_id to leads table for Fireflies matching
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Add missing pipeline_stage enum values
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'spam';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'cancelled';
