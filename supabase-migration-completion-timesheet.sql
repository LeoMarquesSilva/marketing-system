-- Migração: Tipos de conclusão, Timesheet e Auth
-- completion_type, time_entries, users.auth_id

-- 1. Campo completion_type em marketing_requests
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS completion_type TEXT;
CREATE INDEX IF NOT EXISTS idx_marketing_requests_completion_type ON marketing_requests(completion_type);

-- 2. Tabela time_entries
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES marketing_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_request_id ON time_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for time_entries" ON time_entries FOR ALL USING (true) WITH CHECK (true);

-- 3. Campo auth_id em users (vincula ao Supabase Auth)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
