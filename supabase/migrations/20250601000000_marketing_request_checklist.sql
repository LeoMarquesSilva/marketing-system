-- Checklist items attached to marketing requests (e.g. onboarding package)

CREATE TABLE IF NOT EXISTS marketing_request_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES marketing_requests(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_request_id
  ON marketing_request_checklist_items(request_id);

CREATE INDEX IF NOT EXISTS idx_checklist_items_request_sort
  ON marketing_request_checklist_items(request_id, sort_order);

COMMENT ON TABLE marketing_request_checklist_items IS
  'Checklist items for marketing requests (onboarding packages, etc.)';

ALTER TABLE marketing_request_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for marketing_request_checklist_items"
  ON marketing_request_checklist_items
  FOR ALL
  USING (true)
  WITH CHECK (true);
