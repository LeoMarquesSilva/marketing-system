-- Campos de aprovação para content_roteiros
ALTER TABLE content_roteiros
  ADD COLUMN IF NOT EXISTS approved_by_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_alterations boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS alterations_notes text,
  ADD COLUMN IF NOT EXISTS sent_for_manager_review boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_content_roteiros_approved_by ON content_roteiros(approved_by_id);

COMMENT ON COLUMN content_roteiros.approved_by_id IS 'Usuário (advogado) que aprovou o post';
COMMENT ON COLUMN content_roteiros.approved_by_name IS 'Nome do advogado que aprovou';
COMMENT ON COLUMN content_roteiros.has_alterations IS 'Se o advogado fará alterações no conteúdo';
COMMENT ON COLUMN content_roteiros.alterations_notes IS 'Notas sobre as alterações';
COMMENT ON COLUMN content_roteiros.sent_for_manager_review IS 'Se já enviou para revisão do gestor';
