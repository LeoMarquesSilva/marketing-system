-- Reels no banco de conteúdo + etapa Tarefas Leonardo (visível só para Leonardo)

ALTER TABLE marketing_requests
  ADD COLUMN IF NOT EXISTS parent_request_id uuid REFERENCES marketing_requests(id) ON DELETE SET NULL;

COMMENT ON COLUMN marketing_requests.parent_request_id IS
  'Solicitação pai (ex.: tarefas automáticas geradas a partir de um reel).';

CREATE INDEX IF NOT EXISTS idx_marketing_requests_parent_request_id
  ON marketing_requests (parent_request_id)
  WHERE parent_request_id IS NOT NULL;

ALTER TABLE marketing_requests DROP CONSTRAINT IF EXISTS marketing_requests_request_type_check;

ALTER TABLE marketing_requests
  ADD CONSTRAINT marketing_requests_request_type_check
  CHECK (
    request_type = ANY (
      ARRAY[
        'Comunicado',
        'PPT',
        'Post Redes Sociais',
        'Reel Redes Sociais',
        'Aplicação de Identidade',
        'Certificados',
        'E-book',
        'Identidade Visual',
        'Newsletter',
        'Material Impresso',
        'Relatório',
        'Apresentação',
        'Onboarding'
      ]::text[]
    )
  );

INSERT INTO request_types (id, name, "order")
VALUES (13, 'Reel Redes Sociais', 13)
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('request_types', 'id'),
  COALESCE((SELECT MAX(id) FROM request_types), 1)
);

UPDATE app_settings
SET value = (
  SELECT jsonb_agg(elem ORDER BY (elem->>'sortOrder')::int)
  FROM (
    SELECT elem
    FROM jsonb_array_elements(value) AS elem
    WHERE elem->>'value' <> 'tarefas_leonardo'
    UNION ALL
    SELECT jsonb_build_object(
      'value', 'tarefas_leonardo',
      'label', 'Tarefas Leonardo',
      'sortOrder', 7,
      'showInKanban', true,
      'visibleToUserIds', jsonb_build_array('2f08c695-770e-47ce-b4e4-ce27fa414df8')
    )
  ) s(elem)
),
updated_at = now()
WHERE key = 'workflow_stages';
